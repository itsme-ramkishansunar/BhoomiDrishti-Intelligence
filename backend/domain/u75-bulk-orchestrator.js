import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { upsertProject, getProject, listProjects, audit, createBulkPromotionBatch, updateBulkPromotionBatch, recordBulkPromotionEvidence } from '../db.js';
import { buildProjectBootstrap } from './project-lifecycle.js';
import { refreshUnifiedProjectSnapshot } from './unified-data-backbone.js';
import { initializeProjectFeatures } from './bulk-features.js';
import { matchProjectCandidate } from './u75-bulk-integration.js';

export const U75_ORCHESTRATOR_VERSION = 'u75.1-cross-module-orchestrator-v1';
export const U75_5_PROMOTION_VERSION = 'u75.5-safe-source-promotion-v2';

const aliases = {
  id:['id','projectId','project_id'],
  name:['name','projectName','project_name'],
  code:['code','projectCode','project_code'],
  type:['type','projectType','project_type','acquisition_type','acquisitionType'],
  state:['state'], district:['district'], village:['village'],
  responsibleDepartment:['responsibleDepartment','responsible_department','department'],
  totalParcels:['totalParcels','total_parcels','total_land_parcels'],
  parcelsAcquired:['parcelsAcquired','parcels_acquired','acquired_land_parcels'],
  familiesAffected:['familiesAffected','families_affected'],
  familiesPending:['familiesPending','families_pending','pending_compensation_cases'],
  avgDelayDays:['avgDelayDays','avg_delay_days','averageDelayDays'],
  disputes:['disputes'], courtCases:['courtCases','court_cases','legal_cases'],
  approvalPct:['approvalPct','approval_pct'], docsMissing:['docsMissing','docs_missing','documentation_gap_days'],
  resettlementPct:['resettlementPct','resettlement_pct'], rehabPct:['rehabPct','rehab_pct'],
  depts:['depts','departments'], prevDelays:['prevDelays','prev_delays'], stageIndex:['stageIndex','stage_index'],
  status:['status','project_status'], plannedDays:['plannedDays','planned_days'], actualDays:['actualDays','actual_days'],
  latitude:['latitude','project_latitude','lat'], longitude:['longitude','project_longitude','lon','lng'],
  sourceLabel:['sourceLabel','source_label','source'], sourceId:['sourceId','source_id'],
  sourceVersion:['sourceVersion','source_version'], sourceEffectiveAt:['sourceEffectiveAt','source_effective_at'],
  sourceRetrievedAt:['sourceRetrievedAt','source_retrieved_at'], sourceChecksum:['sourceChecksum','source_checksum'],
  locationPrecision:['locationPrecision','location_precision'], locationSource:['locationSource','location_source'],
  locationLabel:['locationLabel','location_label'], geometryGeoJSON:['geometryGeoJSON','geometry_geojson'],
};

function value(row, key) {
  for (const k of aliases[key] || []) {
    if (row && Object.prototype.hasOwnProperty.call(row,k)) {
      const v=row[k];
      if (v!==undefined && v!==null && String(v).trim()!=='') return v;
    }
  }
  return undefined;
}
function num(v, fallback=undefined){ if(v===undefined)return fallback; const n=Number(String(v).replace(/,/g,'')); return Number.isFinite(n)?n:fallback; }
function clean(v){ return v===undefined ? undefined : String(v).trim(); }

export function normalizeProjectRow(row={}, {sourceLabel='USER_UPLOAD', sourceId=null, sourceChecksum=null}={}) {
  const out={};
  for(const key of Object.keys(aliases)) { const v=value(row,key); if(v!==undefined) out[key]=v; }
  out.name=clean(out.name); out.code=clean(out.code);
  out.state=clean(out.state)||'Unknown'; out.district=clean(out.district)||'Unknown';
  out.type=clean(out.type)||'Highway';
  for(const key of ['totalParcels','parcelsAcquired','familiesAffected','familiesPending','avgDelayDays','disputes','courtCases','approvalPct','docsMissing','resettlementPct','rehabPct','depts','prevDelays','stageIndex','plannedDays','actualDays']) {
    if(out[key]!==undefined) out[key]=num(out[key]);
  }
  if(out.latitude!==undefined) out.latitude=num(out.latitude);
  if(out.longitude!==undefined) out.longitude=num(out.longitude);
  if(out.status) out.status=/^completed$/i.test(String(out.status))?'completed':'ongoing';
  out.sourceLabel=clean(out.sourceLabel)||sourceLabel;
  out.sourceId=clean(out.sourceId)||sourceId||null;
  out.sourceChecksum=clean(out.sourceChecksum)||sourceChecksum||null;
  return out;
}

const mutableFields=['name','code','type','state','district','responsibleDepartment','totalParcels','parcelsAcquired','familiesAffected','familiesPending','avgDelayDays','disputes','courtCases','approvalPct','docsMissing','resettlementPct','rehabPct','depts','prevDelays','stageIndex','status','plannedDays','actualDays','latitude','longitude','locationPrecision','locationSource','locationLabel','geometryGeoJSON'];

export function compareIncoming(existing, incoming) {
  const conflicts=[];
  for(const field of mutableFields){
    if(incoming[field]===undefined) continue;
    const a=existing?.[field]; const b=incoming[field];
    if(a===null || a===undefined || String(a)==='') continue;
    const same=typeof a==='number' || typeof b==='number' ? Number(a)===Number(b) : String(a).trim().toLowerCase()===String(b).trim().toLowerCase();
    if(!same) conflicts.push({field,existing:a,incoming:b});
  }
  return conflicts;
}

function mergeNonEmpty(existing, incoming) {
  const merged={...existing};
  for(const field of mutableFields){ if(incoming[field]!==undefined && incoming[field]!==null && String(incoming[field]).trim()!=='') merged[field]=incoming[field]; }
  merged.id=existing.id;
  return merged;
}

export function previewBulkPromotion(rows=[], {sourceLabel='USER_UPLOAD', sourceId=null, sourceChecksum=null}={}) {
  const projects=listProjects();
  return rows.map((row,index)=>{
    const incoming=normalizeProjectRow(row,{sourceLabel,sourceId,sourceChecksum});
    const match=matchProjectCandidate(incoming,projects);
    const existing=match.project || null;
    const conflicts=existing ? compareIncoming(existing,incoming) : [];
    const action=existing ? (conflicts.length ? 'REVIEW_CONFLICT' : 'UPDATE_MATCHED') : 'CREATE_PROJECT';
    return {row:index+1,incoming,matchState:match.state,confidence:match.confidence||0,projectId:existing?.id||incoming.id||null,projectName:existing?.name||incoming.name||null,conflicts,action};
  });
}

export function promoteBulkRows(rows=[], {approvedRows=[], sourceLabel='USER_UPLOAD', sourceId=null, sourceChecksum=null, actor={email:'system',role:'Administrator'}, deps={}}={}) {
  const preview=previewBulkPromotion(rows,{sourceLabel,sourceId,sourceChecksum});
  const approved=new Set((approvedRows||[]).map(Number));
  const results=[]; const errors=[];
  for(const item of preview){
    if(!approved.has(item.row)){ results.push({...item,status:'SKIPPED_REVIEW'}); continue; }
    if(item.matchState==='CONFLICT' || item.conflicts.length){ results.push({...item,status:'BLOCKED_CONFLICT'}); continue; }
    try {
      const existing=item.projectId ? getProject(item.projectId) : null;
      const normalized=existing ? mergeNonEmpty(existing,item.incoming) : {...item.incoming,id:item.incoming.id||`P-${crypto.randomUUID().slice(0,8).toUpperCase()}`};
      normalized.sourceLabel=sourceLabel; normalized.sourceId=sourceId; normalized.sourceChecksum=sourceChecksum;
      const project=upsertProject(normalized,actor);
      const bootstrap=buildProjectBootstrap(project,deps);
      let snapshot=null; try { snapshot=refreshUnifiedProjectSnapshot(project,{generatedBy:actor.email||'bulk-promotion'}); } catch(error){ errors.push({row:item.row,stage:'snapshot',error:String(error?.message||error)}); }
      let features=null; try { features=initializeProjectFeatures(project,{force:true}); } catch(error){ errors.push({row:item.row,stage:'features',error:String(error?.message||error)}); }
      audit({actor:actor.email,actorRole:actor.role,action:'u75.bulk.promoted',resourceType:'project',resourceId:project.id,outcome:'success',metadata:{row:item.row,matchState:item.matchState,sourceId,sourceChecksum}});
      results.push({...item,status:'PROMOTED',project,bootstrap,snapshotId:snapshot?.id||null,featureCount:features?.length||0});
    } catch(error){
      errors.push({row:item.row,stage:'promotion',error:String(error?.message||error)});
      results.push({...item,status:'FAILED',error:String(error?.message||error)});
    }
  }
  return {version:U75_ORCHESTRATOR_VERSION,summary:{requested:rows.length,approved:approved.size,promoted:results.filter(x=>x.status==='PROMOTED').length,blocked:results.filter(x=>x.status==='BLOCKED_CONFLICT').length,skipped:results.filter(x=>x.status==='SKIPPED_REVIEW').length,failed:results.filter(x=>x.status==='FAILED').length},results,errors};
}



function fieldEvidence(item, {batchId, ingestionRunId, sourceLabel, sourceId, sourceChecksum, actor, decisions={}}={}) {
  const existing=item.projectId ? getProject(item.projectId) : null;
  const fields=new Set([...mutableFields.filter(f=>item.incoming?.[f]!==undefined), ...(item.conflicts||[]).map(c=>c.field)]);
  return [...fields].map(field=>{
    const conflict=(item.conflicts||[]).find(c=>c.field===field);
    const decision=conflict ? (decisions[`${item.row}:${field}`]||'BLOCK_CONFLICT') : (existing?'APPLY_INCOMING':'CREATE_PROJECT');
    return {batchId,ingestionRunId,rowNumber:item.row,projectId:item.projectId||null,fieldName:field,
      incomingValue:item.incoming?.[field],existingValue:existing?.[field],decision,matchState:item.matchState,
      sourceLabel,sourceId,sourceChecksum,confidence:item.confidence||0,metadata:{conflict:Boolean(conflict),actor:actor?.email||'system'}};
  });
}

export function previewSafeBulkPromotion(rows=[], {sourceLabel='USER_UPLOAD', sourceId=null, sourceChecksum=null, ingestionRunId=null}={}) {
  const preview=previewBulkPromotion(rows,{sourceLabel,sourceId,sourceChecksum});
  const batch=createBulkPromotionBatch({ingestionRunId,status:'PLANNED',summary:{rows:preview.length,version:U75_5_PROMOTION_VERSION}},{email:'system',role:'system'});
  const evidence=[];
  for(const item of preview) evidence.push(...fieldEvidence(item,{batchId:batch.id,ingestionRunId,sourceLabel,sourceId,sourceChecksum,actor:{email:'system'},decisions:{}}));
  recordBulkPromotionEvidence(evidence,{email:'system',role:'system'});
  updateBulkPromotionBatch(batch.id,{status:'REVIEW_REQUIRED',summary:{rows:preview.length,conflicts:preview.filter(x=>x.conflicts.length).length,version:U75_5_PROMOTION_VERSION}});
  return {version:U75_5_PROMOTION_VERSION,batchId:batch.id,preview,evidenceCount:evidence.length};
}

export function promoteBulkRowsSafe(rows=[], {approvedRows=[],conflictAcknowledgedRows=[],conflictDecisions={},sourceLabel='USER_UPLOAD',sourceId=null,sourceChecksum=null,ingestionRunId=null,actor={email:'system',role:'Administrator'},deps={}}={}) {
  const preview=previewBulkPromotion(rows,{sourceLabel,sourceId,sourceChecksum});
  const approved=new Set((approvedRows||[]).map(Number));
  const acknowledged=new Set((conflictAcknowledgedRows||[]).map(Number));
  const batch=createBulkPromotionBatch({ingestionRunId,status:'PROMOTION_RUNNING',summary:{requested:rows.length,approved:approved.size,version:U75_5_PROMOTION_VERSION} },actor);
  const results=[]; const errors=[]; const evidence=[];
  for(const item of preview){
    const conflict=item.conflicts.length>0;
    if(!approved.has(item.row)){ results.push({...item,status:'SKIPPED_REVIEW'}); evidence.push(...fieldEvidence(item,{batchId:batch.id,ingestionRunId,sourceLabel,sourceId,sourceChecksum,actor,decisions:conflictDecisions})); continue; }
    if(conflict && !acknowledged.has(item.row)){ results.push({...item,status:'BLOCKED_CONFLICT'}); evidence.push(...fieldEvidence(item,{batchId:batch.id,ingestionRunId,sourceLabel,sourceId,sourceChecksum,actor,decisions:conflictDecisions})); continue; }
    try {
      const existing=item.projectId ? getProject(item.projectId) : null;
      const normalized=existing ? mergeNonEmpty(existing,item.incoming) : {...item.incoming,id:item.incoming.id||`P-${crypto.randomUUID().slice(0,8).toUpperCase()}`};
      if(existing && conflict){
        // Safety invariant: non-empty existing values always win on conflicts.
        for(const c of item.conflicts) normalized[c.field]=existing[c.field];
      }
      normalized.sourceLabel=sourceLabel; normalized.sourceId=sourceId; normalized.sourceChecksum=sourceChecksum;
      const project=upsertProject(normalized,actor);
      const bootstrap=buildProjectBootstrap(project,deps);
      let snapshot=null; try { snapshot=refreshUnifiedProjectSnapshot(project,{generatedBy:actor.email||'bulk-promotion'}); } catch(error){ errors.push({row:item.row,stage:'snapshot',error:String(error?.message||error)}); }
      let features=null; try { features=initializeProjectFeatures(project,{force:true}); } catch(error){ errors.push({row:item.row,stage:'features',error:String(error?.message||error)}); }
      evidence.push(...fieldEvidence(item,{batchId:batch.id,ingestionRunId,sourceLabel,sourceId,sourceChecksum,actor,decisions:conflictDecisions}));
      audit({actor:actor.email,actorRole:actor.role,action:'u75.5.bulk.safe_promoted',resourceType:'project',resourceId:project.id,outcome:'success',metadata:{row:item.row,matchState:item.matchState,conflicts:item.conflicts.length,conflictPolicy:'KEEP_EXISTING'} });
      results.push({...item,status:'PROMOTED_SAFE',project,bootstrap,snapshotId:snapshot?.id||null,featureCount:features?.length||0,conflictPolicy:conflict?'KEEP_EXISTING':'NONE'});
    } catch(error){
      errors.push({row:item.row,stage:'promotion',error:String(error?.message||error)});
      results.push({...item,status:'FAILED',error:String(error?.message||error)});
    }
  }
  recordBulkPromotionEvidence(evidence,actor);
  const summary={requested:rows.length,approved:approved.size,promoted:results.filter(x=>x.status==='PROMOTED_SAFE').length,blocked:results.filter(x=>x.status==='BLOCKED_CONFLICT').length,skipped:results.filter(x=>x.status==='SKIPPED_REVIEW').length,failed:results.filter(x=>x.status==='FAILED').length,conflictRows:preview.filter(x=>x.conflicts.length).length,conflictsKeptExisting:preview.filter(x=>x.conflicts.length&&acknowledged.has(x.row)).length};
  updateBulkPromotionBatch(batch.id,{status:summary.failed?'PARTIAL':'COMPLETED',summary:{...summary,version:U75_5_PROMOTION_VERSION}});
  return {version:U75_5_PROMOTION_VERSION,batchId:batch.id,summary,results,errors,evidenceCount:evidence.length};
}

export function safeStoredRunPath(root, storedPath, incomingDir) {
  const resolved=path.resolve(root,storedPath||'');
  const allowed=path.resolve(incomingDir);
  if(resolved!==allowed && !resolved.startsWith(allowed+path.sep)) throw new Error('Stored dataset path is outside the governed incoming-data directory.');
  if(!fs.existsSync(resolved)) throw new Error('Stored dataset file is no longer available.');
  return resolved;
}

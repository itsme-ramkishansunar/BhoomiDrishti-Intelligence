import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export const U75_BULK_INTEGRATION_VERSION = 'u75-bulk-integration-v2';
export const U75_SOURCE_STATES = ['LIVE_AUTHORIZED','PUBLIC_SNAPSHOT','USER_UPLOAD','SYNTHETIC','UNAVAILABLE'];
export const U75_INGESTION_STATES = ['RECEIVED','PROFILED','VALIDATION_REQUIRED','VALIDATED','PARTIALLY_ACCEPTED','REJECTED','VERIFIED','PROMOTED'];
export const U75_MATCH_STATES = ['EXACT_MATCH','HIGH_CONFIDENCE_MATCH','POSSIBLE_MATCH','NO_MATCH','CONFLICT'];

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function classifyU75Source({sourceClassification='', sourceLabel='', synthetic=false}={}) {
  const raw = `${sourceClassification} ${sourceLabel}`.toLowerCase();
  if (synthetic || raw.includes('synthetic') || raw.includes('simulated')) return 'SYNTHETIC';
  if (raw.includes('official') || raw.includes('authoritative') || raw.includes('authorised') || raw.includes('authorized')) return 'LIVE_AUTHORIZED';
  if (raw.includes('snapshot') || raw.includes('public')) return 'PUBLIC_SNAPSHOT';
  if (raw.includes('user_uploaded') || raw.includes('user uploaded') || raw.includes('upload')) return 'USER_UPLOAD';
  return 'UNAVAILABLE';
}

function cleanKey(value='') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

export function profileRows(rows=[]) {
  const list = Array.isArray(rows) ? rows : [];
  const keys = new Set();
  list.forEach(row => { if (row && typeof row === 'object' && !Array.isArray(row)) Object.keys(row).forEach(k=>keys.add(k)); });
  const columns = [...keys];
  const stats = columns.map(name => {
    let nulls = 0; const values = new Set();
    for (const row of list) {
      const v = row?.[name];
      if (v === null || v === undefined || String(v).trim() === '') nulls += 1;
      else values.add(typeof v === 'string' ? v.trim() : JSON.stringify(v));
    }
    return {name, nullCount:nulls, nullRate:list.length?Number((nulls/list.length).toFixed(4)):0, distinctCount:values.size};
  });
  const rowHashes = list.map(row=>crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'));
  const duplicateCount = rowHashes.length - new Set(rowHashes).size;
  const nullCells = stats.reduce((n,s)=>n+s.nullCount,0);
  const totalCells = Math.max(1,list.length*columns.length);
  return {
    rowCount:list.length,
    columnCount:columns.length,
    columns:stats,
    duplicateCount,
    duplicateRate:list.length?Number((duplicateCount/list.length).toFixed(4)):0,
    nullCellRate:Number((nullCells/totalCells).toFixed(4)),
    emptyDataset:list.length===0 || columns.length===0,
  };
}

export function buildU75IntakeState(report={}) {
  const root = report?.files ? report : null;
  const fileReports = Array.isArray(root?.files) ? root.files : [report];
  const valid = fileReports.filter(x=>x && !x.error);
  const rows = valid.reduce((n,r)=>n+(Number(r.rows)||0)+(Array.isArray(r.sheets)?r.sheets.reduce((m,s)=>m+(Number(s.rows)||0),0):0),0);
  const duplicateRows = valid.reduce((n,r)=>n+(Number(r.duplicateRowCount)||0)+(Array.isArray(r.sheets)?r.sheets.reduce((m,s)=>m+(Number(s.duplicateRowCount)||0),0):0),0);
  const columns = valid.reduce((n,r)=>n+(Number(r.columns)||0)+(Array.isArray(r.sheets)?r.sheets.reduce((m,s)=>m+(Number(s.columns)||0),0):0),0);
  const nullRates = valid.flatMap(r=>{
    const xs=[r,...(r.sheets||[])];
    return xs.map(x=>100-Number(x?.depthProfile?.completeness?.cellCompletenessPct ?? 100)).filter(Number.isFinite);
  });
  const nullRate = nullRates.length ? Math.max(...nullRates)/100 : 0;
  const duplicateRate = rows ? duplicateRows/rows : 0;
  if (!rows || !columns) return 'VALIDATION_REQUIRED';
  if (duplicateRate > 0.20 || nullRate > 0.50) return 'PARTIALLY_ACCEPTED';
  if (valid.length !== fileReports.length) return 'VALIDATION_REQUIRED';
  return 'PROFILED';
}

export function validateBulkRows(rows=[], {requiredFields=[], allowedStatuses=[]}={}) {
  const list = Array.isArray(rows) ? rows : [];
  const profile = profileRows(list);
  const errors = [];
  const warnings = [];
  if (profile.emptyDataset) errors.push({code:'EMPTY_DATASET',message:'No rows or columns were supplied.'});
  const normalized = new Map(profile.columns.map(c=>[cleanKey(c.name),c.name]));
  for (const field of requiredFields) if (!normalized.has(cleanKey(field))) errors.push({code:'MISSING_REQUIRED_COLUMN',field});
  if (profile.duplicateCount) warnings.push({code:'DUPLICATE_ROWS',count:profile.duplicateCount});
  if (profile.nullCellRate > 0.30) warnings.push({code:'HIGH_MISSINGNESS',rate:profile.nullCellRate});
  if (allowedStatuses.length) {
    const statusKey = normalized.get('status');
    if (statusKey) {
      const allowed = new Set(allowedStatuses.map(v=>cleanKey(v)));
      list.forEach((row,index)=>{
        const value=cleanKey(row?.[statusKey]);
        if(value && !allowed.has(value)) errors.push({code:'INVALID_STATUS',row:index+1,value:row?.[statusKey]});
      });
    }
  }
  return {valid:errors.length===0,profile,errors,warnings,state:errors.length?'VALIDATION_REQUIRED':'VALIDATED'};
}

function normalizedValue(value='') { return cleanKey(value); }
function similarity(a,b) {
  const aa=new Set(normalizedValue(a).split('_').filter(Boolean));
  const bb=new Set(normalizedValue(b).split('_').filter(Boolean));
  if(!aa.size||!bb.size)return 0;
  const inter=[...aa].filter(x=>bb.has(x)).length;
  return inter/new Set([...aa,...bb]).size;
}

export function matchProjectCandidate(incoming={}, projects=[]) {
  const rows = Array.isArray(projects) ? projects : [];
  const incomingId = incoming.projectId ?? incoming.project_id ?? incoming.id;
  const incomingCode = incoming.projectCode ?? incoming.project_code ?? incoming.code;
  const exactId = incomingId ? rows.find(p=>String(p.id)===String(incomingId)) : null;
  if(exactId) return {state:'EXACT_MATCH',confidence:1,project:exactId,reason:'project identifier exact match'};
  const exactCode = incomingCode ? rows.find(p=>String(p.code).toLowerCase()===String(incomingCode).toLowerCase()) : null;
  if(exactCode) return {state:'EXACT_MATCH',confidence:1,project:exactCode,reason:'project code exact match'};
  const candidates = rows.map(p=>{
    const nameScore=similarity(incoming.projectName??incoming.project_name??incoming.name,p.name);
    const district=normalizedValue(incoming.district) && normalizedValue(incoming.district)===normalizedValue(p.district) ? 1 : 0;
    const state=normalizedValue(incoming.state) && normalizedValue(incoming.state)===normalizedValue(p.state) ? 1 : 0;
    const department=normalizedValue(incoming.department??incoming.responsibleDepartment) && normalizedValue(incoming.department??incoming.responsibleDepartment)===normalizedValue(p.responsibleDepartment) ? 1 : 0;
    const score=0.55*nameScore+0.20*district+0.15*state+0.10*department;
    return {project:p,score,nameScore,district,state,department};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const top=candidates[0];
  if(!top || top.score<0.60) return {state:'NO_MATCH',confidence:top?.score||0,candidates:candidates.slice(0,5)};
  const second=candidates[1];
  if(second && Math.abs(top.score-second.score)<0.08) return {state:'CONFLICT',confidence:top.score,candidates:candidates.slice(0,5),reason:'multiple candidates have similar matching confidence'};
  return {state:top.score>=0.90?'HIGH_CONFIDENCE_MATCH':'POSSIBLE_MATCH',confidence:Number(top.score.toFixed(4)),project:top.project,candidates:candidates.slice(0,5)};
}

export function runtimeDoctor({root, dbPath, port=8787, frontendPort=5173}={}) {
  const checks = [];
  checks.push({key:'root_exists',ok:fs.existsSync(root),detail:root});
  checks.push({key:'package_exists',ok:fs.existsSync(path.join(root,'package.json')),detail:'package.json'});
  checks.push({key:'backend_exists',ok:fs.existsSync(path.join(root,'backend','server.js')),detail:'backend/server.js'});
  checks.push({key:'db_parent_exists',ok:fs.existsSync(path.dirname(dbPath)),detail:path.dirname(dbPath)});
  checks.push({key:'u75_module_exists',ok:fs.existsSync(path.join(root,'backend','domain','u75-bulk-integration.js')),detail:'u75-bulk-integration.js'});
  return {version:U75_BULK_INTEGRATION_VERSION,checks,ok:checks.every(c=>c.ok),ports:{backend:port,frontend:frontendPort}};
}

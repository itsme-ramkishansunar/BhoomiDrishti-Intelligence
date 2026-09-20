import { listProjects, listBulkFeatureStates, upsertBulkFeatureState, createBulkFeatureRun, listBulkFeatureRuns, getProjectDataFacts, listProjectEvents, listPredictions, listRecommendations, listOperationalAlerts, listProjectIntelligenceSnapshots } from '../db.js';

export const BULK_FEATURE_REGISTRY_VERSION = 'bulk-feature-registry-v1';

export const BULK_FEATURE_REGISTRY = Object.freeze([
  { key:'UNIFIED_PROJECT_FACTS', label:'Unified project facts', capability:'facts', requires:[] },
  { key:'UNIFIED_INTELLIGENCE', label:'Unified intelligence snapshot', capability:'snapshot', requires:[] },
  { key:'CANDIDATE_PREDICTION', label:'Candidate predictive intelligence', capability:'prediction', requires:[] },
  { key:'PREDICTION_EXPLANATION', label:'Predictive explanation', capability:'prediction_explanation', requires:['CANDIDATE_PREDICTION'] },
  { key:'EARLY_WARNING', label:'Early-warning intelligence', capability:'warning', requires:[] },
  { key:'OPERATIONAL_ALERTS', label:'Operational alerts', capability:'alerts', requires:[] },
  { key:'ACTION_RECOMMENDATIONS', label:'Action recommendations', capability:'recommendations', requires:[] },
  { key:'PROJECT_LIFECYCLE', label:'Project lifecycle', capability:'lifecycle', requires:[] },
  { key:'EVIDENCE_GRAPH', label:'Evidence graph', capability:'evidence', requires:[] },
  { key:'PRECISE_GIS', label:'Precise GIS mapping', capability:'gis', requires:[] },
  { key:'WORKFLOW_CLOCK_CONTEXT', label:'Workflow/legal-clock context', capability:'workflow', requires:[] },
  { key:'GROUNDED_AI_CONTEXT', label:'Grounded Bhoomi AI context', capability:'ai', requires:[] },
  { key:'ACTION_OUTCOME_LOOP', label:'Action/outcome loop', capability:'actions', requires:[] },
  { key:'REPLAY_HISTORY', label:'Replay/history', capability:'replay', requires:[] },
  { key:'PROVENANCE_GOVERNANCE', label:'Provenance + ML governance', capability:'governance', requires:[] },
]);

function evaluateFeature(project, feature) {
  const facts = getProjectDataFacts(project.id).length;
  const snapshot = listProjectIntelligenceSnapshots(project.id,1).length > 0;
  const prediction = listPredictions(project.id,1).length > 0;
  const recommendations = listRecommendations(project.id).length > 0;
  const alerts = listOperationalAlerts({projectIds:[project.id],status:'all',limit:500}).length;
  const events = listProjectEvents(project.id).length;
  const hasLocation = Boolean(project.geometryGeoJSON || (Number.isFinite(Number(project.latitude)) && Number.isFinite(Number(project.longitude))));
  const checks = {
    facts: facts >= 20,
    snapshot,
    prediction,
    prediction_explanation: prediction,
    warning: prediction,
    alerts: project.status === 'ongoing' ? alerts > 0 : true,
    recommendations: project.status === 'ongoing' ? recommendations : true,
    lifecycle: events > 0,
    evidence: facts > 0,
    gis: hasLocation,
    workflow: Boolean(project.acquisitionProfile),
    ai: facts > 0 && snapshot,
    actions: true,
    replay: events > 0,
    governance: true,
  };
  const ok = checks[feature.capability] !== false;
  if (feature.key === 'PRECISE_GIS' && !hasLocation) return { status:'REVIEW_REQUIRED', readiness:'PARTIAL', blockedReason:'No reliable project-level geometry or coordinate is stored; project must remain spatially unresolved.' };
  if (feature.key === 'WORKFLOW_CLOCK_CONTEXT' && !checks.workflow) return { status:'REVIEW_REQUIRED', readiness:'PARTIAL', blockedReason:'Acquisition framework/profile is not configured; statutory applicability remains unresolved.' };
  if (feature.key === 'OPERATIONAL_ALERTS' && project.status === 'ongoing' && alerts === 0) return { status:'REVIEW_REQUIRED', readiness:'PARTIAL', blockedReason:'No operational alert is currently persisted for this project.' };
  if (!ok) return { status:'REVIEW_REQUIRED', readiness:'PARTIAL', blockedReason:`Required ${feature.label.toLowerCase()} state is not yet available.` };
  return { status:'READY', readiness:'COMPLETE', blockedReason:null };
}

export function initializeProjectFeatures(project,{force=false}={}) {
  const states=[];
  for (const feature of BULK_FEATURE_REGISTRY) {
    const existing=listBulkFeatureStates(project.id).find(s=>s.featureKey===feature.key);
    if(existing && !force) { states.push(existing); continue; }
    const result=evaluateFeature(project,feature);
    const state=upsertBulkFeatureState({
      projectId:project.id, featureKey:feature.key, featureVersion:BULK_FEATURE_REGISTRY_VERSION,
      status:result.status, readiness:result.readiness, provenanceStatus:'DERIVED', sourceType:'UNIFIED_REPOSITORY',
      evidenceCount:getProjectDataFacts(project.id).length, blockedReason:result.blockedReason,
      metadata:{capability:feature.capability,requires:feature.requires,projectStatus:project.status},
    });
    states.push(state);
  }
  return states;
}

export function bulkInitializeFeatures({onlyMissing=true,force=false,filters={}}={}) {
  const projects=listProjects(filters); const startedAt=new Date().toISOString(); const results=[]; const errors=[];
  for(const project of projects){
    try{
      const existing=listBulkFeatureStates(project.id);
      if(onlyMissing && existing.length===BULK_FEATURE_REGISTRY.length && existing.every(s=>s.featureVersion===BULK_FEATURE_REGISTRY_VERSION)){
        results.push({projectId:String(project.id),name:project.name,skipped:true,states:existing});
      } else {
        const states=initializeProjectFeatures(project,{force:true});
        results.push({projectId:String(project.id),name:project.name,skipped:false,states});
      }
    }catch(error){errors.push({projectId:String(project.id),name:project.name,error:String(error?.message||error)});}
  }
  const allStates=results.flatMap(r=>r.states||[]);
  const summary={version:BULK_FEATURE_REGISTRY_VERSION,startedAt,completedAt:new Date().toISOString(),featureCount:BULK_FEATURE_REGISTRY.length,projectCount:projects.length,initialized:results.filter(r=>!r.skipped).length,skipped:results.filter(r=>r.skipped).length,failed:errors.length,errors,featureTotals:{ready:allStates.filter(s=>s.status==='READY').length,reviewRequired:allStates.filter(s=>s.status==='REVIEW_REQUIRED').length,blocked:allStates.filter(s=>s.status==='BLOCKED').length,notApplicable:allStates.filter(s=>s.status==='NOT_APPLICABLE').length,complete:allStates.filter(s=>s.readiness==='COMPLETE').length}};
  const run=createBulkFeatureRun({...summary,metadata:{force:Boolean(force),onlyMissing:Boolean(onlyMissing)}});
  return {summary,run,results};
}

export function getBulkFeatureStatus(){
  const projects=listProjects(); const total=projects.length*BULK_FEATURE_REGISTRY.length; let ready=0,reviewRequired=0,blocked=0,notApplicable=0,complete=0,initializedProjects=0;
  for(const project of projects){ const states=listBulkFeatureStates(project.id); if(states.length===BULK_FEATURE_REGISTRY.length && states.every(s=>s.featureVersion===BULK_FEATURE_REGISTRY_VERSION)) initializedProjects++; for(const s of states){if(s.status==='READY')ready++;if(s.status==='REVIEW_REQUIRED')reviewRequired++;if(s.status==='BLOCKED')blocked++;if(s.status==='NOT_APPLICABLE')notApplicable++;if(s.readiness==='COMPLETE')complete++;}}
  return {version:BULK_FEATURE_REGISTRY_VERSION,featureCount:BULK_FEATURE_REGISTRY.length,projectCount:projects.length,totalExpected:total,initializedProjects,featureTotals:{ready,reviewRequired,blocked,notApplicable,complete},fullyInitialized:projects.length>0&&initializedProjects===projects.length,totalRuns:listBulkFeatureRuns(10)};
}

export function getProjectFeatureStatus(projectId){
  const states=listBulkFeatureStates(projectId); const byKey=new Map(states.map(s=>[s.featureKey,s]));
  return {version:BULK_FEATURE_REGISTRY_VERSION,projectId:String(projectId),features:BULK_FEATURE_REGISTRY.map(f=>({...f,state:byKey.get(f.key)||null})),initialized:states.length===BULK_FEATURE_REGISTRY.length&&states.every(s=>s.featureVersion===BULK_FEATURE_REGISTRY_VERSION)};
}

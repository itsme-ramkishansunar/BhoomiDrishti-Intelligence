/**
 * U75.9 Bulk Intelligence Propagation
 *
 * Reusable intelligence contract for bulk promotion -> downstream decision support.
 * This module is deliberately deterministic and evidence-labelled. It does not
 * create a validated production probability and does not mutate project facts.
 */
export const U75_9_BULK_INTELLIGENCE_VERSION = 'u75.9-bulk-intelligence-propagation-v1';

const clamp = (n,min=0,max=100) => Math.max(min,Math.min(max,Number(n)||0));

export const INTELLIGENCE_PROVENANCE_STATES = Object.freeze([
  'OBSERVED','DERIVED','FORECAST','SIMULATED','UNAVAILABLE'
]);

export function classifyIntelligenceProvenance({ sourceLabel='', authoritative=false, kind='observed', available=true }={}) {
  if (!available) return { state:'UNAVAILABLE', authoritative:false, reason:'Required source or evidence is unavailable.' };
  const k=String(kind||'observed').toLowerCase();
  if (k==='simulated' || k==='scenario') return { state:'SIMULATED', authoritative:false, reason:'Scenario output; not a project fact.' };
  if (k==='forecast' || k==='prediction') return { state:'FORECAST', authoritative:false, reason:'Candidate predictive output; not a validated production probability.' };
  if (k==='derived' || k==='rule' || k==='computed') return { state:'DERIVED', authoritative:Boolean(authoritative), reason:'Computed from stored project evidence and deterministic rules.' };
  return { state:'OBSERVED', authoritative:Boolean(authoritative), reason:`Observed/source record: ${sourceLabel || 'unspecified source'}.` };
}

export function buildRiskVelocity(predictions=[]) {
  const rows=(predictions||[]).slice(0,3);
  const current=rows[0]||null;
  const previous=rows[1]||null;
  if (!current) return {status:'UNAVAILABLE',current:null,previous:null,delta:null,direction:'unknown',label:'No stored prediction history'};
  const cur=Number(current.delayProbability);
  const prev=Number(previous?.delayProbability);
  if (!Number.isFinite(cur)) return {status:'UNAVAILABLE',current:null,previous:null,delta:null,direction:'unknown',label:'Current risk history is incomplete'};
  if (!Number.isFinite(prev)) return {status:'BASELINE',current:clamp(cur*100),previous:null,delta:null,direction:'baseline',label:'Baseline candidate risk; no prior comparable record'};
  const delta=(cur-prev)*100;
  const direction=delta>2?'increasing':delta<-2?'decreasing':'stable';
  return {
    status:'AVAILABLE',
    current:clamp(cur*100),
    previous:clamp(prev*100),
    delta:Number(delta.toFixed(2)),
    direction,
    label:`Risk ${direction} by ${Math.abs(delta).toFixed(1)} points versus the previous stored candidate score.`,
    disclaimer:'Risk velocity is a descriptive comparison of stored candidate scores; it is not a causal effect or validated forecast.'
  };
}

export function buildInterventionIntelligence(project,{risk={},actions=[],timeline=null,riskVelocity=null}={}) {
  const candidates=(actions||[]).map((a,i)=>({
    ...a,
    rank:i+1,
    urgency:a.severity==='critical'?4:a.severity==='high'?3:a.severity==='medium'?2:1,
  }));
  const overdue=Boolean(timeline?.activeStage?.overdue);
  const velocityIncreasing=riskVelocity?.direction==='increasing';
  const ranked=[...candidates].sort((a,b)=>
    (Number(b.urgency)||0)-(Number(a.urgency)||0) ||
    (velocityIncreasing && String(a.severity)==='high'? -1:1)
  ).slice(0,6).map((a,i)=>({...a,rank:i+1}));
  return {
    version:'u75.9-intervention-intelligence-v1',
    projectId:project?.id,
    attentionScore:clamp(risk?.overall||0),
    urgencySignals:{overdueStage:overdue,riskVelocity:velocityIncreasing?'increasing':'not_increasing'},
    candidates:ranked,
    actionability:ranked.length?'ACTION_QUEUE_READY':'NO_RULE_MATCH',
    disclaimer:'Intervention intelligence is deterministic decision support. It does not establish causality, legal authority, or a guaranteed outcome.'
  };
}

export function buildBulkIntelligenceEnvelope(project,{
  facts=[],predictions=[],stages=[],events=[],featureStates=[],alerts=[],recommendations=[],
  earlyWarning=null,actionIntelligence=null,timeline=null,risk=null
}={}) {
  const source=project?.source||{};
  const provenance=classifyIntelligenceProvenance({
    sourceLabel:source.label||project?.sourceLabel||'unspecified',
    authoritative:Boolean(source.authoritative),
    kind:'observed',
    available:true
  });
  const riskVelocity=buildRiskVelocity(predictions);
  const actions=actionIntelligence?.candidates||[];
  const intervention=buildInterventionIntelligence(project,{risk:risk||{},actions,timeline,riskVelocity});
  const ready=featureStates.filter(s=>s.status==='READY').length;
  const review=featureStates.filter(s=>s.status==='REVIEW_REQUIRED').length;
  return {
    version:U75_9_BULK_INTELLIGENCE_VERSION,
    generatedAt:new Date().toISOString(),
    project:{
      id:String(project.id),code:project.code,name:project.name,state:project.state,district:project.district,
      status:project.status,stage:project.stageName||project.stageIndex
    },
    evidence:{facts:facts.length,events:events.length,alerts:alerts.length,recommendations:recommendations.length},
    risk:risk||{overall:null,band:'UNAVAILABLE'},
    riskVelocity,
    earlyWarning,
    actionIntelligence,
    intervention,
    timeline,
    featureReadiness:{total:featureStates.length,ready,reviewRequired:review,complete:featureStates.filter(s=>s.readiness==='COMPLETE').length},
    provenance:{
      projectRecord:provenance,
      predictive:classifyIntelligenceProvenance({kind:'prediction',available:Boolean(predictions.length)}),
      derived:classifyIntelligenceProvenance({kind:'derived',available:true}),
      simulated:classifyIntelligenceProvenance({kind:'simulated',available:false})
    },
    governance:{
      productionPredictionAllowed:false,
      note:'Candidate predictive outputs remain governed. Bulk propagation does not promote a production ML model.'
    }
  };
}

export function summarizeBulkIntelligence(results=[]) {
  const rows=results||[];
  return {
    version:U75_9_BULK_INTELLIGENCE_VERSION,
    projectCount:rows.length,
    succeeded:rows.filter(r=>r.status==='READY').length,
    failed:rows.filter(r=>r.status==='FAILED').length,
    reviewRequired:rows.filter(r=>Number(r.featureReadiness?.reviewRequired||0)>0).length,
    highAttention:rows.filter(r=>Number(r.risk?.overall||0)>=65).length,
    riskVelocityIncreasing:rows.filter(r=>r.riskVelocity?.direction==='increasing').length,
    actionQueuesReady:rows.filter(r=>r.intervention?.actionability==='ACTION_QUEUE_READY').length,
    generatedAt:new Date().toISOString()
  };
}

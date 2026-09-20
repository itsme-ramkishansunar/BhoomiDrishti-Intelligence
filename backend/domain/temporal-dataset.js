import crypto from 'node:crypto';
import { listProjects, listProjectEvents, createDatasetVersion, insertTemporalExample, insertTemporalSplit, insertLeakageAudit, updateDatasetVersion } from '../db.js';

export const TEMPORAL_DATASET_VERSION = 'temporal-baseline-v1';
export const TEMPORAL_FEATURE_POLICY = 'strict_as_of_event_and_stable_context_v1';
const OUTCOME_ONLY_FIELDS = new Set(['actualDays','avgDelayDays','status']);

const clampDate = (value) => { const d=new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const daysBetween = (a,b) => Math.max(0, (b.getTime()-a.getTime())/86400000);
const normalizeEvents = (events=[]) => events.map(e=>({ ...e, t:clampDate(e.effectiveAt||e.occurredAt||e.recordedAt) })).filter(e=>e.t);

function snapshotTimes(events) {
  const times=[];
  for(const e of events) times.push(e.t.toISOString());
  return [...new Set(times)].sort();
}

function stageAt(events) {
  let stage = null;
  for(const e of events){
    const payload=e.payload||{};
    if(payload.stageIndex !== undefined) stage=Number(payload.stageIndex);
  }
  return Number.isFinite(stage) ? stage : null;
}

export function buildAsOfFeatureSnapshot(project, events, asOf) {
  const t=clampDate(asOf); if(!t) throw new Error('Invalid as_of timestamp.');
  const usable=normalizeEvents(events).filter(e=>e.t.getTime()<=t.getTime()).sort((a,b)=>a.t-b.t);
  const last=usable.at(-1) || null;
  const stage=stageAt(usable);
  const eventCounts={};
  for(const e of usable) eventCounts[e.eventType]=(eventCounts[e.eventType]||0)+1;
  const stageChanges=usable.filter(e=>e.payload && e.payload.stageIndex!==undefined).length;
  const daysSinceLastEvent=last ? daysBetween(last.t,t) : null;
  return {
    asOf:t.toISOString(),
    features:{
      event_count:usable.length,
      distinct_event_types:Object.keys(eventCounts).length,
      stage_index_as_of:stage,
      stage_change_count:stageChanges,
      days_since_last_event:daysSinceLastEvent===null?null:Number(daysSinceLastEvent.toFixed(3)),
      current_event_code:last?.eventCode||null,
    },
    featureSources:usable.map(e=>({eventId:e.id,eventType:e.eventType,effectiveAt:e.t.toISOString()})),
    stableContext:{state:project.state,district:project.district,type:project.type,acquisitionProfile:project.acquisitionProfile||null},
  };
}

export function buildOutcome(project) {
  const planned=Number(project.plannedDays);
  const actual=Number(project.actualDays);
  const observed=project.status==='completed' && Number.isFinite(planned) && planned>0 && Number.isFinite(actual) && actual>=0;
  if(observed){
    const delayDays=Math.max(0,actual-planned);
    return {labelObserved:true,delayLabel:delayDays>0?1:0,observedDelayDays:delayDays,observedDurationDays:actual,censored:false,censorReason:null,outcomeAt:project.source?.effectiveAt||null};
  }
  return {labelObserved:false,delayLabel:null,observedDelayDays:null,observedDurationDays:null,censored:project.status==='ongoing',censorReason:project.status==='ongoing'?'right_censored_at_latest_available_snapshot':'outcome_missing',outcomeAt:null};
}

export function auditExample(example) {
  const issues=[];
  const asOf=clampDate(example.asOf);
  for(const source of example.featureSources||[]){
    const st=clampDate(source.effectiveAt);
    if(!st || !asOf) continue;
    if(st.getTime()>asOf.getTime()) issues.push({severity:'error',ruleCode:'FEATURE_AFTER_AS_OF',featureKey:source.eventType,asOf:asOf.toISOString(),sourceTime:st.toISOString(),detail:'Feature source event occurs after the prediction as-of timestamp.'});
  }
  for(const key of Object.keys(example.features||{})){
    if(OUTCOME_ONLY_FIELDS.has(key)) issues.push({severity:'error',ruleCode:'OUTCOME_FIELD_IN_FEATURES',featureKey:key,asOf:example.asOf,detail:'Outcome/future-state field is prohibited from the predictive feature vector.'});
  }
  return issues;
}

function projectCohortTime(project, events) {
  const normalized=normalizeEvents(events);
  const terminal=normalized.at(-1)?.t;
  return (project.source?.effectiveAt && clampDate(project.source.effectiveAt))?.toISOString() || terminal?.toISOString() || project.source?.retrievedAt || null;
}

function allocateProjectSplits(projects, eventsByProject) {
  const cohorts=projects.map(p=>({id:p.id,time:clampDate(projectCohortTime(p,eventsByProject.get(p.id)||[]))})).filter(x=>x.time).sort((a,b)=>a.time-b.time);
  const n=cohorts.length;
  if(n<3) return {mode:'insufficient_for_temporal_split',map:new Map(),cohorts:n};
  const trainEnd=Math.max(1,Math.floor(n*0.70));
  const valEnd=Math.max(trainEnd+1,Math.floor(n*0.85));
  const map=new Map();
  cohorts.forEach((c,i)=>map.set(c.id,i<trainEnd?'train':i<valEnd?'validation':'test'));
  return {mode:'project_cohort_temporal',map,cohorts:n};
}

export function buildTemporalDataset({createdBy=null, version=TEMPORAL_DATASET_VERSION}={}) {
  const projects=listProjects({});
  const eventsByProject=new Map(projects.map(p=>[p.id, normalizeEvents(listProjectEvents(p.id))]));
  const dataset=createDatasetVersion({version:`${version}-${Date.now()}`,grain:'project × as_of_event',sourceScope:'currently authorised repository records',asOfPolicy:'Only event/context records known by as_of may enter features; outcome fields are label-only.',labelDefinition:'Completed projects: delay_label = 1 when actual_days > planned_days; ongoing projects are right-censored and have no binary label.',status:'building',createdBy,metadata:{engine:'temporal-dataset-v1',stableContextExcludedFromLabel:false}});
  const splitInfo=allocateProjectSplits(projects,eventsByProject);
  let exampleCount=0, observed=0, censored=0, violations=0;
  for(const project of projects){
    const events=eventsByProject.get(project.id)||[];
    const times=snapshotTimes(events);
    const outcome=buildOutcome(project);
    if(!times.length) continue;
    for(const asOf of times){
      const snap=buildAsOfFeatureSnapshot(project,events,asOf);
      const example={id:crypto.randomUUID(),datasetVersionId:dataset.id,projectId:project.id,asOf:snap.asOf,features:snap.features,context:snap.stableContext,featureSources:snap.featureSources,...outcome,sourceEventCount:events.filter(e=>e.t<=new Date(asOf)).length,featurePolicy:TEMPORAL_FEATURE_POLICY};
      const issues=auditExample(example);
      for(const issue of issues){insertLeakageAudit({datasetVersionId:dataset.id,exampleId:example.id,...issue}); if(issue.severity==='error') violations++;}
      insertTemporalExample(example); exampleCount++; if(example.labelObserved) observed++; if(example.censored) censored++;
      const split=splitInfo.map.get(project.id)||'unassigned';
      insertTemporalSplit({datasetVersionId:dataset.id,exampleId:example.id,split,cohortTime:projectCohortTime(project,events)});
    }
  }
  const finalStatus=violations===0 ? (observed>=3 && splitInfo.mode!=='insufficient_for_temporal_split' ? 'research_ready_candidate' : 'insufficient_labeled_data') : 'blocked_leakage';
  return updateDatasetVersion(dataset.id,{status:finalStatus,exampleCount,observedLabelCount:observed,censoredCount:censored,leakageViolations:violations,metadata:{splitMode:splitInfo.mode,cohortProjects:splitInfo.cohorts,trainingEligibleLabelCount:observed,warning:observed<20?'Very small labelled population; do not claim model performance.':null}});
}

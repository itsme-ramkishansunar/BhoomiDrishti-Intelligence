import crypto from 'node:crypto';

function norm(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s/.-]+/gu,' ').replace(/\s+/g,' ').trim();}
function confidence(values){const vals=values.filter(v=>v!=null&&String(v).trim()!=='').map(norm);if(!vals.length)return 0;if(new Set(vals).size===1)return 1;const counts=new Map(); for(const v of vals) counts.set(v,(counts.get(v)||0)+1);const max=Math.max(...counts.values());return max/vals.length;}
function key(type,value){return `${type}:${norm(value)}`;}
function entity(type,value,source='canonical'){const v=String(value??'').trim();if(!v)return null;const k=key(type,v);return {id:`CAN-${crypto.createHash('sha1').update(k).digest('hex').slice(0,14)}`,type,value:v,normalizedValue:norm(v),source,confidence:1};}

export function buildCanonicalProject({analysis={},createdBy='system'}={}){
  const ext=analysis.extracted||{}; const draft=analysis.projectDraft||{}; const entities=Array.isArray(analysis.entityResolution?.entities)?analysis.entityResolution.entities:[]; const graph=Array.isArray(analysis.entityResolution?.edges)?analysis.entityResolution.edges:[];
  const conflicts=[...(analysis.conflicts||[]),...(analysis.entityResolution?.conflicts||[])].filter((c,i,a)=>i===a.findIndex(x=>x.field===c.field&&JSON.stringify(x.values)===JSON.stringify(c.values)));
  const canonicalEntities=entities.map(e=>({...e,canonicalKey:key(e.type,e.value),reviewRequired:(e.confidence||0)<0.85}));
  const grouped={};
  for(const e of canonicalEntities){(grouped[e.type] ||= []).push(e);}
  const ids={surveyNumbers:[...new Set((grouped.survey_number||[]).map(e=>e.value))],khasraNumbers:[...new Set((grouped.khasra_number||[]).map(e=>e.value))],ulpins:[...new Set((grouped.ulpin||[]).map(e=>e.value))],caseNumbers:[...new Set((grouped.case_number||[]).map(e=>e.value))]};
  const identity={name:draft.name||ext.projectName||null,state:ext.state||null,district:ext.district||null,village:ext.village||null,acquisitionType:ext.acquisitionType||draft.type||null};
  const evidenceFields={}; for(const f of (analysis.fieldEvidence||[])) evidenceFields[f.field]={value:f.value,document:f.document,sha256:f.sha256||null,excerpt:f.excerpt||null};
  const timeline=(analysis.milestoneTimeline||[]).map(e=>({...e,canonicalKey:key('milestone',`${e.key}|${e.rawDate}`)}));
  const canonicalStatus=conflicts.length?'REVIEW_REQUIRED':'READY_FOR_REVIEW';
  const completeness=Number(analysis.completenessPct||0); const evidence=Number(analysis.evidenceCoveragePct||0); const identityConfidence=Math.round(confidence(Object.values(identity))*100); const conflictPenalty=Math.min(40,conflicts.length*10); const canonicalReadiness=Math.max(0,Math.round((completeness*.35)+(evidence*.35)+(identityConfidence*.30)-conflictPenalty));
  return {schemaVersion:'canonical-project-v1',generatedAt:new Date().toISOString(),createdBy,sourceClassification:analysis.sourceClassification||'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',status:canonicalStatus,projectIdentity:identity,identifiers:ids,evidenceFields,timeline,entities:canonicalEntities,links:graph,conflicts,quality:{completenessPct:completeness,evidenceCoveragePct:evidence,identityConfidencePct:identityConfidence,conflictCount:conflicts.length,readinessPct:canonicalReadiness},governance:{authoritative:false,humanReviewRequired:canonicalStatus!=='READY_FOR_REVIEW',reviewThresholdPct:85,notes:['Canonicalization reconciles candidate evidence into a reviewable project record.','It does not establish legal ownership, official parcel identity, or government truth.']}};
}

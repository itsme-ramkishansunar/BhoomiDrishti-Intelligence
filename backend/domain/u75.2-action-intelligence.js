/**
 * U75.2 Governed Action Intelligence
 * Deterministic recommendation rules are deliberately separate from prediction.
 * No rule here asserts causality, legal authority, or validated ML probability.
 */
export const U75_2_ACTION_INTELLIGENCE_VERSION = 'u75.2-governed-action-intelligence-v1';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=(n)=>clamp(Number(n||0),0,100);
const rules=[
  {code:'RISK_ATTENTION_V1',priority:1,ownerRole:'Government Officer',severity:'high',
   when:p=>String(p.status)==='ongoing' && Number(p.risk?.overall||0)>=65,
   action:p=>`Review the ${p.risk.overall}/100 delay-exposure record and verify the two strongest drivers with current evidence.`,
   basis:'risk_engine_current_record',evidence:p=>[`risk:${p.risk.overall}`,`drivers:${(p.risk.drivers||[]).slice(0,2).map(d=>d.key).join(',')}`]},
  {code:'COMPENSATION_BACKLOG_V1',priority:1,ownerRole:'Compensation / Revenue Cell',severity:'high',
   when:p=>Number(p.familiesPending||0)>0 && (Number(p.avgDelayDays||0)>=30 || (Number(p.familiesAffected||0)>0 && Number(p.familiesPending||0)/Number(p.familiesAffected||1)>=0.25)),
   action:p=>`Review and age ${p.familiesPending} pending compensation case(s); assign verified owners and due dates for the oldest cases.`,
   basis:'compensation_backlog_rule',evidence:p=>[`families_pending:${p.familiesPending}`,`avg_delay_days:${p.avgDelayDays}`]},
  {code:'LEGAL_REVIEW_V1',priority:1,ownerRole:'Legal Officer',severity:'high',
   when:p=>Number(p.disputes||0)>=3 || Number(p.courtCases||0)>=2,
   action:p=>`Verify ${p.disputes||0} ownership dispute(s) and ${p.courtCases||0} court-linked case(s) against current legal records and record the next verified action.`,
   basis:'legal_exposure_rule',evidence:p=>[`disputes:${p.disputes||0}`,`court_cases:${p.courtCases||0}`]},
  {code:'DOCUMENT_COMPLETENESS_V1',priority:2,ownerRole:'Department Officer',severity:'medium',
   when:p=>Number(p.docsMissing||0)>=10,
   action:p=>`Create a document-gap checklist for ${p.docsMissing} missing/incomplete item(s) and route each item to a responsible verification owner.`,
   basis:'document_completeness_rule',evidence:p=>[`docs_missing:${p.docsMissing||0}`,`approval_pct:${p.approvalPct||0}`]},
  {code:'APPROVAL_QUEUE_V1',priority:2,ownerRole:'Government Officer',severity:'medium',
   when:p=>Number(p.approvalPct||0)<70,
   action:p=>`Identify pending approval checkpoints and assign accountable owners with evidence-backed due dates.`,
   basis:'approval_queue_rule',evidence:p=>[`approval_pct:${p.approvalPct||0}`]},
  {code:'STAGE_DELAY_REVIEW_V1',priority:2,ownerRole:'Government Officer',severity:'medium',
   when:p=>Number(p.actualDays||0)>0 && Number(p.plannedDays||0)>0 && Number(p.actualDays)>Number(p.plannedDays),
   action:p=>`Review the current stage duration against the configured project plan; verify the delay source before escalation.`,
   basis:'project_plan_variance_rule',evidence:p=>[`planned_days:${p.plannedDays}`,`actual_days:${p.actualDays}`]},
  {code:'RR_PROGRESS_REVIEW_V1',priority:2,ownerRole:'R&R Officer',severity:'medium',
   when:p=>Number(p.resettlementPct||0)<70 || Number(p.rehabPct||0)<70,
   action:p=>`Review resettlement (${p.resettlementPct||0}%) and rehabilitation (${p.rehabPct||0}%) readiness against current project-stage evidence.`,
   basis:'rr_readiness_rule',evidence:p=>[`resettlement_pct:${p.resettlementPct||0}`,`rehab_pct:${p.rehabPct||0}`]},
  {code:'ROUTINE_MONITORING_V1',priority:4,ownerRole:'Government Officer',severity:'low',
   when:p=>String(p.status)==='ongoing',
   action:p=>`Continue routine monitoring and verify the latest source records before changing project status or risk.`,
   basis:'routine_monitoring_rule',evidence:p=>[`status:${p.status}`]},
];

export function evaluateActionRules(project,{risk}={}){
  const p={...project,risk:risk||{overall:0,drivers:[]}};
  return rules.filter(r=>{try{return Boolean(r.when(p))}catch{return false;}}).map(r=>({
    ruleCode:r.code,priority:r.priority,ownerRole:r.ownerRole,severity:r.severity,
    actionText:r.action(p),basisType:r.basis,evidence:r.evidence(p),
    disclaimer:'Rule-based decision support only; verify current evidence and applicable authority before acting.'
  }));
}
export function buildActionIntelligence(project,{risk}={}){
  const candidates=evaluateActionRules(project,{risk});
  return {version:U75_2_ACTION_INTELLIGENCE_VERSION,generatedAt:new Date().toISOString(),projectId:project.id,
    candidateCount:candidates.length,candidates,disclaimer:'Recommendations are deterministic workflow signals, not legal determinations, causal claims, or validated production predictions.'};
}

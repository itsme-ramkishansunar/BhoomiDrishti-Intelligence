export const STAGES = [
  'Land Identification',
  'Notification',
  'Survey',
  'Ownership Verification',
  'Compensation',
  'Possession',
  'Resettlement',
  'Completed',
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const WEIGHTS = { compensation: 0.28, legal: 0.20, approval: 0.15, documentation: 0.12, resettlement: 0.15, administrative: 0.10 };
const CATEGORY_LABEL = {
  compensation: 'Compensation Risk',
  legal: 'Legal Risk',
  approval: 'Approval Risk',
  documentation: 'Documentation Risk',
  resettlement: 'Resettlement Risk',
  administrative: 'Administrative Risk',
};
const DRIVER_TEXT = {
  compensation: (p) => `${p.familiesPending} of ${p.familiesAffected} affected families are still awaiting compensation, with payments overdue by an average of ${p.avgDelayDays} days.`,
  legal: (p) => `${p.disputes} ownership dispute${p.disputes === 1 ? '' : 's'} and ${p.courtCases} court case${p.courtCases === 1 ? '' : 's'} are recorded in the current project data.`,
  approval: (p) => `Recorded approval completion is ${p.approvalPct}%.`,
  documentation: (p) => `${p.docsMissing} document${p.docsMissing === 1 ? '' : 's'} are recorded as missing or incomplete.`,
  resettlement: (p) => `Resettlement progress is ${p.resettlementPct}% and rehabilitation progress is ${p.rehabPct}%.`,
  administrative: (p) => `${p.depts} departments are recorded as involved, with ${p.prevDelays} prior delay${p.prevDelays === 1 ? '' : 's'} in the project record.`,
};
const ACTIONS = {
  compensation: ['Review and age outstanding compensation cases.', 'Route long-pending payments to the responsible compensation workflow.'],
  legal: ['Verify active disputes and court-linked records with the authorised legal function.', 'Record the next verified legal action and due date.'],
  approval: ['Identify each pending approval checkpoint.', 'Assign an accountable owner and due date for stalled approvals.'],
  documentation: ['Generate a document-gap checklist by category.', 'Assign each verification item to a responsible workflow owner.'],
  resettlement: ['Review resettlement and rehabilitation readiness against the current stage.', 'Track unresolved entitlements and readiness gaps to closure.'],
  administrative: ['Set a coordination owner across departments.', 'Track inter-departmental dependencies to explicit due dates.'],
};

export function computeRisk(p) {
  const compDays = clamp(Number(p.avgDelayDays || 0) / 90, 0, 1);
  const compFam = Number(p.familiesAffected || 0) ? clamp(Number(p.familiesPending || 0) / Number(p.familiesAffected), 0, 1) : 0;
  const compensation = Math.round(100 * (0.6 * compDays + 0.4 * compFam));
  const disputeS = clamp(Number(p.disputes || 0) / 8, 0, 1);
  const courtS = clamp(Number(p.courtCases || 0) / 5, 0, 1);
  const legal = Math.round(100 * (0.55 * disputeS + 0.45 * courtS));
  const approval = Math.round(clamp(100 - Number(p.approvalPct || 0), 0, 100));
  const documentation = Math.round(100 * clamp(Number(p.docsMissing || 0) / 40, 0, 1));
  const resettlement = Math.round(0.5 * clamp(100 - Number(p.resettlementPct || 0), 0, 100) + 0.5 * clamp(100 - Number(p.rehabPct || 0), 0, 100));
  const deptS = clamp((Number(p.depts || 0) - 2) / 6, 0, 1);
  const prevS = clamp(Number(p.prevDelays || 0) / 3, 0, 1);
  const administrative = Math.round(100 * (0.5 * deptS + 0.5 * prevS));
  const categories = { compensation, legal, approval, documentation, resettlement, administrative };
  const overall = Math.round(Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * categories[key], 0));
  const band = overall >= 65 ? 'high' : overall >= 40 ? 'medium' : 'low';
  const drivers = Object.keys(categories).map((key) => ({ key, label: CATEGORY_LABEL[key], value: categories[key], contribution: Number((WEIGHTS[key] * categories[key]).toFixed(2)), text: DRIVER_TEXT[key](p) })).sort((a, b) => b.contribution - a.contribution);
  const bottleneck = drivers[0];
  const second = drivers[1];
  const explanation = band === 'low'
    ? `The current record is relatively stable. ${bottleneck.label.replace(' Risk', '')} remains the main area to monitor.`
    : `The current record carries ${band} delay exposure, driven mainly by ${bottleneck.label.toLowerCase()} and ${second.label.toLowerCase()}. ${bottleneck.text}`;
  const recommendedActions = drivers.filter((d) => d.value >= 45).slice(0, 3).flatMap((d) => ACTIONS[d.key]);
  return { overall, band, categories, drivers, bottleneck, explanation, recommendedActions: recommendedActions.length ? recommendedActions.slice(0, 6) : ['Continue routine monitoring and verify the latest source records.'] };
}

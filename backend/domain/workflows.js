export const PROVENANCE_LABELS = {
  official: 'OFFICIAL',
  derived: 'DERIVED',
  synthetic: 'SYNTHETIC',
  simulated: 'SIMULATED',
  cached: 'CACHED',
  user_uploaded: 'USER UPLOADED',
  unavailable: 'UNAVAILABLE',
};

export const WORKFLOW_TEMPLATES = {
  NH_ACQUISITION_V1: {
    code: 'NH_ACQUISITION_V1',
    label: 'National Highways Act acquisition pathway',
    act: 'National Highways Act, 1956',
    sourceUrl: 'https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_30_42_00002_195648_1517807321068&type=act',
    stages: [
      { code: '3A', label: '3A — Intention to acquire' },
      { code: '3C', label: '3C — Objections' },
      { code: '3D', label: '3D — Declaration' },
      { code: '3G', label: '3G — Compensation determination' },
      { code: '3H', label: '3H — Deposit/payment' },
      { code: '3E', label: '3E — Possession' },
    ],
    clocks: [
      { code: 'NH_3A_TO_3D', from: '3A', to: '3D', durationDays: 365, clockType: 'statutory', pauseOn: ['COURT_STAY'], source: 'National Highways Act, 1956, section 3D(3)' },
      { code: 'NH_3E_POSSESSION_NOTICE', from: '3E_NOTICE', to: '3E', durationDays: 60, clockType: 'statutory_notice', pauseOn: [], source: 'National Highways Act, 1956, section 3E' },
    ],
  },
  RFCTLARR_CENTRAL_V1: {
    code: 'RFCTLARR_CENTRAL_V1',
    label: 'RFCTLARR 2013 acquisition pathway',
    act: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013',
    sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/17043',
    stages: [
      { code: 'SIA', label: 'Social Impact Assessment' },
      { code: 'PRELIMINARY_NOTIFICATION', label: 'Preliminary notification' },
      { code: 'OBJECTIONS', label: 'Objections / hearing' },
      { code: 'DECLARATION', label: 'Declaration under section 19' },
      { code: 'AWARD', label: 'Collector award' },
      { code: 'RR_AWARD', label: 'Rehabilitation & Resettlement award' },
      { code: 'PAYMENT', label: 'Compensation payment' },
      { code: 'POSSESSION', label: 'Possession' },
    ],
    clocks: [
      { code: 'RF_19_TO_25', from: 'DECLARATION', to: 'AWARD', durationDays: 365, clockType: 'statutory', pauseOn: [], source: 'RFCTLARR Act, 2013, section 25' },
    ],
  },
};

export function inferDemoWorkflow(project) {
  const explicit = String(project?.acquisitionProfile || '').trim();
  if (explicit && WORKFLOW_TEMPLATES[explicit]) return { ...WORKFLOW_TEMPLATES[explicit], basis: 'explicit' };
  if (explicit && /NH/i.test(explicit)) return { ...WORKFLOW_TEMPLATES.NH_ACQUISITION_V1, basis: 'configured_label' };
  if (String(project?.source?.label || '').toLowerCase().includes('synthetic') && /highway/i.test(project?.type || '') && /NH[- ]?\d+/i.test(project?.name || '')) {
    return { ...WORKFLOW_TEMPLATES.NH_ACQUISITION_V1, basis: 'demo_inferred_from_synthetic_name' };
  }
  return {
    code: 'UNRESOLVED',
    label: 'Workflow applicability requires authorised project configuration',
    act: null,
    sourceUrl: null,
    stages: [],
    clocks: [],
    basis: 'unresolved',
  };
}

export function evaluatePossessionReadiness(project, workflow) {
  const compensation = Number(project?.approvalPct ?? 0) >= 90 && Number(project?.familiesPending ?? 0) === 0;
  const rr = Number(project?.resettlementPct ?? 0) >= 90 && Number(project?.rehabPct ?? 0) >= 90;
  const legal = Number(project?.courtCases ?? 0) === 0;
  const docs = Number(project?.docsMissing ?? 0) === 0;
  const ready = compensation && rr && legal && docs;
  const blockers = [];
  if (!compensation) blockers.push('Compensation readiness is incomplete');
  if (!rr) blockers.push('R&R / rehabilitation readiness is incomplete');
  if (!legal) blockers.push('Recorded litigation exposure remains');
  if (!docs) blockers.push('Required project documentation is incomplete');
  return {
    status: ready ? 'READY_REVIEW' : 'NOT_READY',
    blockers,
    dependencyGraph: [
      { node: 'Compensation', status: compensation ? 'ready' : 'blocking' },
      { node: 'R&R', status: rr ? 'ready' : 'blocking' },
      { node: 'Legal', status: legal ? 'ready' : 'blocking' },
      { node: 'Documentation', status: docs ? 'ready' : 'blocking' },
      { node: 'Possession', status: ready ? 'candidate_ready' : 'blocked' },
    ],
    workflow: workflow.code,
  };
}

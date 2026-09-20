const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : 0));
const round = (n, d = 2) => Number(Number(n).toFixed(d));

export const PREDICTIVE_MODEL_VERSION = 'predictive-baseline-v1';
export const PREDICTIVE_MODEL_STATUS = 'candidate_not_validated';

const FEATURE_META = {
  stage_pressure: { label: 'Stage pressure', direction: 'Higher current stage with unresolved risk increases forward pressure.', weight: 0.10 },
  acquisition_gap: { label: 'Acquisition completion gap', direction: 'More parcels remaining increases exposure.', weight: 0.10 },
  compensation_backlog: { label: 'Compensation backlog', direction: 'A larger pending-family ratio increases delay exposure.', weight: 0.16 },
  legal_exposure: { label: 'Legal exposure', direction: 'Disputes and court cases increase uncertainty and potential delay.', weight: 0.18 },
  approval_gap: { label: 'Approval gap', direction: 'Lower approval completion increases administrative exposure.', weight: 0.13 },
  documentation_gap: { label: 'Documentation gap', direction: 'Missing/incomplete records increase process friction.', weight: 0.11 },
  rr_gap: { label: 'R&R readiness gap', direction: 'Lower resettlement and rehabilitation readiness increases exposure.', weight: 0.10 },
  administrative_friction: { label: 'Administrative friction', direction: 'More involved departments and prior delays increase coordination risk.', weight: 0.07 },
  current_delay_signal: { label: 'Current delay signal', direction: 'Higher observed delay days increase forward delay pressure.', weight: 0.05 },
};

const STAGE_HAZARD = [0.08, 0.11, 0.14, 0.17, 0.20, 0.23, 0.21, 0.05];

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

export function buildPredictiveFeatures(project) {
  const total = Math.max(1, Number(project.totalParcels || 0));
  const affected = Math.max(1, Number(project.familiesAffected || 0));
  const stage = Math.max(0, Math.min(7, Number(project.stageIndex || 0)));
  const avgDelay = Math.max(0, Number(project.avgDelayDays || 0));
  const acquisitionCompletion = clamp(Number(project.parcelsAcquired || 0) / total);
  const compensationBacklog = clamp(Number(project.familiesPending || 0) / affected);
  const legalExposure = clamp(0.58 * (Number(project.disputes || 0) / 8) + 0.42 * (Number(project.courtCases || 0) / 5));
  const approvalGap = clamp((100 - Number(project.approvalPct || 0)) / 100);
  const documentationGap = clamp(Number(project.docsMissing || 0) / 40);
  const rrGap = clamp((0.5 * (100 - Number(project.resettlementPct || 0)) + 0.5 * (100 - Number(project.rehabPct || 0))) / 100);
  const administrativeFriction = clamp(0.55 * ((Number(project.depts || 0) - 2) / 6) + 0.45 * (Number(project.prevDelays || 0) / 3));
  const currentDelaySignal = clamp(avgDelay / 90);
  const stagePressure = clamp((stage / 7) * (0.45 + 0.55 * (1 - acquisitionCompletion)));
  return {
    stage_pressure: round(stagePressure),
    acquisition_gap: round(1 - acquisitionCompletion),
    compensation_backlog: round(compensationBacklog),
    legal_exposure: round(legalExposure),
    approval_gap: round(approvalGap),
    documentation_gap: round(documentationGap),
    rr_gap: round(rrGap),
    administrative_friction: round(administrativeFriction),
    current_delay_signal: round(currentDelaySignal),
  };
}

export function estimateDataCompleteness(project) {
  const total = Math.max(1, Number(project.totalParcels || 0));
  const missing = Math.max(0, Number(project.docsMissing || 0));
  const documentCompleteness = clamp(1 - missing / Math.max(20, total));
  const keyFieldCoverage = [
    project.state, project.district, project.type,
    project.totalParcels, project.familiesAffected,
    project.approvalPct, project.stageIndex,
  ].filter(v => v !== undefined && v !== null && String(v).length > 0).length / 7;
  const temporalCoverage = project.source?.effectiveAt || project.source?.retrievedAt ? 0.75 : 0.25;
  return round(clamp(0.5 * documentCompleteness + 0.3 * keyFieldCoverage + 0.2 * temporalCoverage, 0.15, 1), 3);
}

export function scoreCandidatePrediction(project) {
  const features = buildPredictiveFeatures(project);
  const weighted = Object.entries(FEATURE_META).reduce((s, [key, meta]) => s + features[key] * meta.weight, 0);
  const logit = -1.72 + 4.05 * weighted;
  const likelihood = Math.round(sigmoid(logit) * 100);
  const stage = Math.max(0, Math.min(7, Number(project.stageIndex || 0)));
  const hazardBase = STAGE_HAZARD[stage] ?? STAGE_HAZARD[0];
  const hazardMultiplier = 0.78 + 0.72 * weighted;
  const stageHazard = Math.round(clamp(hazardBase * hazardMultiplier, 0.02, 0.45) * 100);
  const expectedAdditionalDays = project.status === 'completed' ? 0 : Math.round(Math.max(0, Number(project.avgDelayDays || 0) * (0.55 + 0.85 * weighted) + stageHazard * 0.65));
  const dataCompleteness = estimateDataCompleteness(project);
  const uncertainty = round(clamp(0.14 + 0.58 * (1 - dataCompleteness) + 0.08, 0.12, 0.75), 3);

  const explanations = Object.entries(FEATURE_META)
    .map(([key, meta]) => ({ key, label: meta.label, value: features[key], contribution: round(features[key] * meta.weight * 100, 2), direction: meta.direction }))
    .sort((a, b) => b.contribution - a.contribution);

  const top = explanations[0];
  const second = explanations[1];
  const trajectory = [
    { horizon: 'Now', likelihoodPct: likelihood },
    { horizon: '+30d', likelihoodPct: Math.round(clamp(likelihood + (project.status === 'ongoing' ? 4 + weighted * 7 : 0), 0, 99)) },
    { horizon: '+60d', likelihoodPct: Math.round(clamp(likelihood + (project.status === 'ongoing' ? 7 + weighted * 12 : 0), 0, 99)) },
    { horizon: '+90d', likelihoodPct: Math.round(clamp(likelihood + (project.status === 'ongoing' ? 9 + weighted * 16 : 0), 0, 99)) },
  ];

  return {
    modelVersion: PREDICTIVE_MODEL_VERSION,
    modelStatus: PREDICTIVE_MODEL_STATUS,
    predictionUnit: 'project',
    asOf: new Date().toISOString(),
    delayLikelihoodPct: likelihood,
    probabilityInterpretation: 'Candidate model score; not a calibrated production probability.',
    expectedAdditionalDays,
    stageHazardPct: stageHazard,
    uncertaintyPct: Math.round(uncertainty * 100),
    dataCompletenessPct: Math.round(dataCompleteness * 100),
    features,
    explanations,
    topDriver: top ? { ...top } : null,
    secondaryDriver: second ? { ...second } : null,
    trajectory,
    validation: {
      status: 'NOT_VALIDATED',
      reason: 'The available demo repository does not contain a sufficiently sized authoritative historical outcome set for production model calibration and evaluation.',
      recommendedSplit: 'Temporal project-level holdout when authorised historical data is onboarded.',
      leakagePolicy: 'Only values available at the prediction as-of timestamp may enter the feature vector.',
    },
  };
}

export function buildPortfolioPredictionSummary(projects) {
  const predictions = projects.filter(Boolean).map(p => ({ project: p, prediction: scoreCandidatePrediction(p) }));
  const active = predictions.filter(x => x.project.status === 'ongoing');
  const ranked = [...active].sort((a, b) => b.prediction.delayLikelihoodPct - a.prediction.delayLikelihoodPct);
  return {
    modelVersion: PREDICTIVE_MODEL_VERSION,
    modelStatus: PREDICTIVE_MODEL_STATUS,
    projectsScored: predictions.length,
    activeProjects: active.length,
    highExposure: ranked.filter(x => x.prediction.delayLikelihoodPct >= 70).length,
    watchlist: ranked.filter(x => x.prediction.delayLikelihoodPct >= 55).length,
    ranked: ranked.slice(0, 12).map(x => ({
      id: x.project.id, name: x.project.name, state: x.project.state, district: x.project.district,
      stageIndex: x.project.stageIndex, delayLikelihoodPct: x.prediction.delayLikelihoodPct,
      expectedAdditionalDays: x.prediction.expectedAdditionalDays, stageHazardPct: x.prediction.stageHazardPct,
      uncertaintyPct: x.prediction.uncertaintyPct, topDriver: x.prediction.topDriver,
    })),
    note: 'Scores are candidate baseline outputs for architecture validation. They must not be represented as calibrated production probabilities until authorised historical outcome data supports temporal evaluation.',
  };
}

export function featureDictionary() { return Object.fromEntries(Object.entries(FEATURE_META).map(([k, v]) => [k, { ...v }])); }

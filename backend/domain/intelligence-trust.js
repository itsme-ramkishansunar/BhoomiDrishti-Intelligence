const clampPct = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));

export const INTELLIGENCE_TRUST_VERSION = 'intelligence-trust-v1';

function present(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export function calculateEvidenceReadiness({ project = {}, canonical = null, temporalSnapshot = null, sourceRows = [] } = {}) {
  const canonicalQuality = canonical?.quality || canonical?.canonical?.quality || {};
  const temporalQuality = temporalSnapshot?.snapshot?.quality || temporalSnapshot?.quality || {};
  const sourceHealth = Array.isArray(sourceRows) && sourceRows.length
    ? sourceRows.filter((r) => ['healthy', 'configured', 'verified'].includes(String(r.health || r.status || '').toLowerCase())).length / sourceRows.length
    : (project?.source ? 0.55 : 0.25);

  const identity = clampPct(canonicalQuality.identityConfidencePct ?? 0);
  const evidence = clampPct(canonicalQuality.evidenceCoveragePct ?? 0);
  const completeness = clampPct(canonicalQuality.completenessPct ?? 0);
  const conflicts = Math.max(0, Number(canonicalQuality.conflictCount ?? 0));
  const conflictScore = clampPct(100 - Math.min(100, conflicts * 12));
  const temporal = clampPct(temporalQuality.qualityPct ?? (temporalSnapshot ? 65 : 20));
  const freshness = project?.source?.retrievedAt ? 75 : 35;
  const linked = clampPct(project?.source?.effectiveAt || project?.source?.retrievedAt ? 70 : 30);
  const source = clampPct(sourceHealth * 100);
  const overall = Math.round(
    identity * 0.16 + evidence * 0.20 + completeness * 0.16 + conflictScore * 0.14 + temporal * 0.14 + freshness * 0.08 + linked * 0.06 + source * 0.06
  );
  return {
    version: INTELLIGENCE_TRUST_VERSION,
    overallPct: Math.max(0, Math.min(100, overall)),
    components: { identityPct: Math.round(identity), evidenceCoveragePct: Math.round(evidence), completenessPct: Math.round(completeness), conflictFreePct: Math.round(conflictScore), temporalPct: Math.round(temporal), freshnessPct: freshness, linkagePct: linked, sourceHealthPct: Math.round(source) },
    status: overall >= 80 ? 'HIGH' : overall >= 60 ? 'MEDIUM' : 'LOW',
    blockers: [
      conflicts > 0 ? `${conflicts} unresolved evidence conflict(s)` : null,
      !temporalSnapshot ? 'No temporal snapshot available' : null,
      identity < 70 ? 'Entity identity confidence is limited' : null,
      evidence < 70 ? 'Evidence coverage is limited' : null,
    ].filter(Boolean),
    note: 'Evidence readiness measures the quality and traceability of inputs; it is not a prediction probability.'
  };
}

export function calculatePredictionApplicability({ project = {}, prediction = null, historicalSignals = {} } = {}) {
  const factors = [];
  const add = (key, label, score, status) => factors.push({ key, label, score: clampPct(score), status });
  add('stage_match', 'Stage comparability', present(project.stageIndex) ? 85 : 35, present(project.stageIndex) ? 'supported' : 'limited');
  add('geography_match', 'Geographic coverage', present(project.state) && present(project.district) ? 80 : 40, present(project.state) && present(project.district) ? 'supported' : 'limited');
  add('outcome_history', 'Historical outcome depth', historicalSignals.observedLabels != null ? Math.min(95, 35 + Number(historicalSignals.observedLabels) * 2) : 25, historicalSignals.observedLabels ? 'measured' : 'unknown');
  add('feature_coverage', 'Feature availability', prediction?.dataCompleteness != null ? Number(prediction.dataCompleteness) * 100 : 30, prediction?.dataCompleteness != null ? 'measured' : 'limited');
  add('model_status', 'Model validation status', /production|validated/i.test(String(prediction?.modelStatus || prediction?.status || '')) ? 90 : 20, /production|validated/i.test(String(prediction?.modelStatus || prediction?.status || '')) ? 'validated' : 'not_validated');
  const score = Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length);
  return {
    version: INTELLIGENCE_TRUST_VERSION,
    scorePct: score,
    status: score >= 80 ? 'HIGH' : score >= 60 ? 'MODERATE' : 'LOW',
    factors,
    blockers: factors.filter((f) => f.status === 'limited' || f.status === 'unknown' || f.status === 'not_validated').map((f) => f.label),
    note: 'Applicability reflects how well the available project evidence matches the conditions for which the current model/contract is supported.'
  };
}

export function buildPredictionDiff(current, previous = null) {
  if (!previous) return { available: false, note: 'No previous stored prediction is available for comparison.' };
  const currentRisk = Number(current?.delayLikelihoodPct ?? current?.delayProbability ?? 0);
  const previousRisk = Number(previous?.delayLikelihoodPct ?? previous?.delayProbability ?? 0);
  const drivers = [];
  const currentDrivers = current?.explanations || [];
  const previousDrivers = previous?.explanations || [];
  const prevByKey = new Map(previousDrivers.map((x) => [x.key, Number(x.contribution || 0)]));
  for (const item of currentDrivers) {
    const delta = Number(item.contribution || 0) - Number(prevByKey.get(item.key) || 0);
    if (Math.abs(delta) >= 0.5) drivers.push({ key: item.key, label: item.label, delta: Number(delta.toFixed(2)) });
  }
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    available: true,
    riskBeforePct: previousRisk,
    riskNowPct: currentRisk,
    deltaPctPoints: Number((currentRisk - previousRisk).toFixed(2)),
    direction: currentRisk > previousRisk ? 'increased' : currentRisk < previousRisk ? 'decreased' : 'unchanged',
    driverDeltas: drivers.slice(0, 8),
    note: 'Prediction diff compares stored model outputs; it does not assert causality.'
  };
}

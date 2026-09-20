import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildPredictiveFeatures, scoreCandidatePrediction, PREDICTIVE_MODEL_STATUS } from './predictive-engine.js';

export const PREDICTIVE_LAB_VERSION = 'predictive-intelligence-v2-candidate';
export const PREDICTIVE_FEATURE_POLICY = 'point_in_time_only_v2';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const ML_ROOT = path.join(root, 'backend', 'data', 'ml');
const ARTIFACT_PATH = path.join(ML_ROOT, 'predictive-intelligence-v2.json');

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) ? Number(n) : 0));
const round = (n, d = 3) => Number(Number(n).toFixed(d));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const FEATURE_KEYS = [
  'stage_index', 'days_in_stage', 'acquisition_completion', 'families_pending_ratio',
  'legal_exposure', 'approval_gap', 'documentation_gap', 'rr_gap',
  'administrative_friction', 'current_delay_signal',
];

const STAGE_NAMES = ['Land Identification', 'Notification', 'Survey', 'Ownership Verification', 'Compensation', 'Possession', 'Resettlement', 'Completed'];
const BASE_STAGE_HAZARD = [0.08, 0.11, 0.14, 0.17, 0.20, 0.23, 0.21, 0.05];

function safeDate(v) { const d = new Date(v); return Number.isFinite(d.getTime()) ? d : null; }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export function buildFeatureVector(project = {}) {
  const base = buildPredictiveFeatures(project);
  const total = Math.max(1, Number(project.totalParcels || 0));
  const affected = Math.max(1, Number(project.familiesAffected || 0));
  const stage = Math.max(0, Math.min(7, Number(project.stageIndex || 0)));
  const start = safeDate(project.startDate || project.createdAt);
  const asOf = safeDate(project.source?.effectiveAt || project.source?.retrievedAt || new Date());
  const daysSinceStart = start && asOf ? Math.max(0, (asOf - start) / 86400000) : 0;
  const daysInStage = Math.max(0, Number(project.daysInStage || (daysSinceStart ? daysSinceStart / Math.max(1, stage + 1) : 0)));
  return {
    stage_index: stage,
    days_in_stage: round(daysInStage / 365),
    acquisition_completion: round(Number(project.parcelsAcquired || 0) / total),
    families_pending_ratio: round(Number(project.familiesPending || 0) / affected),
    legal_exposure: base.legal_exposure,
    approval_gap: base.approval_gap,
    documentation_gap: base.documentation_gap,
    rr_gap: base.rr_gap,
    administrative_friction: base.administrative_friction,
    current_delay_signal: base.current_delay_signal,
  };
}

export function buildCandidateSurvivalCurve(project = {}, horizonDays = 180) {
  const base = buildPredictiveFeatures(project);
  const stage = Math.max(0, Math.min(7, Number(project.stageIndex || 0)));
  const weighted = Object.values(base).reduce((s, v) => s + Number(v || 0), 0) / Math.max(1, Object.keys(base).length);
  const currentHazard = clamp((BASE_STAGE_HAZARD[stage] || 0.08) * (0.78 + 0.72 * weighted), 0.02, 0.45);
  const points = [];
  let survival = 1;
  for (let day = 0; day <= horizonDays; day += 30) {
    const phase = 1 + Math.min(0.45, day / Math.max(1, horizonDays) * 0.45);
    const monthlyHazard = clamp(currentHazard * phase, 0.005, 0.5);
    if (day > 0) survival *= (1 - monthlyHazard);
    points.push({ day, survivalPct: Math.round(survival * 100), delayExposurePct: Math.round((1 - survival) * 100) });
  }
  return {
    interpretation: 'Candidate exposure curve derived from the current stage signal. It is not a calibrated survival probability.',
    currentStage: STAGE_NAMES[stage] || STAGE_NAMES[0],
    currentHazardPct: Math.round(currentHazard * 100),
    points,
  };
}

function readArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8')); } catch (_) { return null; }
}

function predictStoredModel(model, vector) {
  if (!model?.weights || !model?.standardizer || !Array.isArray(model.featureKeys)) return null;
  let z = Number(model.weights[0] || 0);
  model.featureKeys.forEach((k, i) => {
    const st = model.standardizer[k] || { mean: 0, std: 1 };
    const x = (Number(vector[k] || 0) - Number(st.mean || 0)) / (Number(st.std || 1) || 1);
    z += Number(model.weights[i + 1] || 0) * x;
  });
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

function artifactOOD(artifact, vector) {
  if (!artifact?.ood?.featureStats) return { status: 'NOT_AVAILABLE', distance: null, threshold: null, message: 'OOD applicability is unavailable until a reviewed training artifact exists.' };
  const distances = FEATURE_KEYS.map(k => {
    const s = artifact.ood.featureStats[k];
    if (!s || !Number.isFinite(Number(s.std)) || Number(s.std) <= 0) return 0;
    return ((Number(vector[k] || 0) - Number(s.mean || 0)) / Number(s.std)) ** 2;
  });
  const distance = Math.sqrt(distances.reduce((a, b) => a + b, 0));
  const threshold = Number(artifact.ood.threshold || 3.5);
  return { status: distance > threshold ? 'OUT_OF_DISTRIBUTION' : 'IN_DISTRIBUTION', distance: round(distance, 2), threshold: round(threshold, 2), message: distance > threshold ? 'Current feature vector is outside the reviewed training distribution.' : 'Current feature vector is within the reviewed training distribution.' };
}

export function buildProjectLabPrediction(project, { artifact = readArtifact() } = {}) {
  const candidate = scoreCandidatePrediction(project);
  const vector = buildFeatureVector(project);
  const ood = artifactOOD(artifact, vector);
  const survival = buildCandidateSurvivalCurve(project);
  const modelPrediction = predictStoredModel(artifact?.model, vector);
  return {
    version: PREDICTIVE_LAB_VERSION,
    projectId: project.id,
    projectName: project.name,
    asOf: new Date().toISOString(),
    modelStatus: artifact ? 'RESEARCH_CANDIDATE' : PREDICTIVE_MODEL_STATUS.toUpperCase(),
    featurePolicy: PREDICTIVE_FEATURE_POLICY,
    featureVector: vector,
    candidateBaseline: candidate,
    survival,
    ood,
    researchModelScorePct: Number.isFinite(modelPrediction) ? Math.round(clamp(modelPrediction) * 100) : null,
    probabilityStatus: 'NOT_CALIBRATED',
    governance: {
      productionPromotionAllowed: false,
      reason: artifact ? 'Research artifact is isolated from production promotion until every governance gate is satisfied and explicitly approved.' : 'No reviewed training artifact is available. Candidate baseline remains the only predictive signal.',
    },
  };
}

export function buildPredictiveLabSnapshot(projects = [], { readiness = null, dataset = null, artifact = readArtifact() } = {}) {
  const active = projects.filter(p => p && p.status === 'ongoing');
  const predictions = active.map(project => buildProjectLabPrediction(project, { artifact }));
  const distribution = {
    high: predictions.filter(p => p.candidateBaseline.delayLikelihoodPct >= 70).length,
    watch: predictions.filter(p => p.candidateBaseline.delayLikelihoodPct >= 55 && p.candidateBaseline.delayLikelihoodPct < 70).length,
    lower: predictions.filter(p => p.candidateBaseline.delayLikelihoodPct < 55).length,
  };
  const pipeline = [
    { id: 'source', label: 'Authorised source data', status: readiness?.observed?.realData ? 'READY' : 'BLOCKED', detail: readiness?.observed?.realData ? 'Authoritative provenance detected.' : 'Awaiting authorised historical outcome data.' },
    { id: 'temporal', label: 'Temporal dataset', status: dataset?.status === 'research_ready_candidate' ? 'READY' : dataset ? 'REVIEW' : 'BLOCKED', detail: dataset ? `${dataset.exampleCount || 0} temporal examples; ${dataset.observedLabelCount || 0} observed labels.` : 'Build an as-of dataset after source review.' },
    { id: 'training', label: 'Baseline / stage models', status: artifact ? 'READY' : 'BLOCKED', detail: artifact ? `Candidate artifact ${artifact.version}.` : 'Training artifact not generated.' },
    { id: 'calibration', label: 'Probability calibration', status: artifact?.calibration?.validated ? 'READY' : 'BLOCKED', detail: artifact?.calibration?.validated ? 'Validation calibration recorded.' : 'Requires a sufficiently sized temporal validation set.' },
    { id: 'ood', label: 'OOD / applicability', status: artifact?.ood ? 'READY' : 'BLOCKED', detail: artifact?.ood ? 'Feature-distribution applicability checks available.' : 'Requires reviewed training distribution.' },
    { id: 'governance', label: 'Promotion gate', status: 'BLOCKED', detail: 'Production promotion is intentionally disabled until governance approval.' },
  ];
  return {
    version: PREDICTIVE_LAB_VERSION,
    generatedAt: new Date().toISOString(),
    featurePolicy: PREDICTIVE_FEATURE_POLICY,
    projectCount: projects.length,
    activeProjectCount: active.length,
    artifact: artifact ? { version: artifact.version, createdAt: artifact.createdAt, trainingRows: artifact.trainingRows, digest: artifact.digest, calibration: artifact.calibration, ood: { threshold: artifact.ood?.threshold || null } } : null,
    pipeline,
    distribution,
    ranked: predictions.sort((a, b) => b.candidateBaseline.delayLikelihoodPct - a.candidateBaseline.delayLikelihoodPct).slice(0, 15).map(p => ({
      projectId: p.projectId, projectName: p.projectName, state: projects.find(x => x.id === p.projectId)?.state, district: projects.find(x => x.id === p.projectId)?.district,
      stage: p.survival.currentStage, signalPct: p.candidateBaseline.delayLikelihoodPct, expectedAdditionalDays: p.candidateBaseline.expectedAdditionalDays,
      topDriver: p.candidateBaseline.topDriver, ood: p.ood.status,
    })),
    governance: { productionPromotionAllowed: false, status: 'BLOCKED', modelStatus: artifact ? 'RESEARCH_CANDIDATE' : PREDICTIVE_MODEL_STATUS.toUpperCase() },
  };
}

export function buildResearchArtifact(rows, model, evaluation, validationPredictions = []) {
  const featureStats = {};
  for (const key of FEATURE_KEYS) {
    const vals = rows.map(r => Number(r[key])).filter(Number.isFinite);
    const m = mean(vals); const variance = mean(vals.map(v => (v - m) ** 2));
    featureStats[key] = { mean: round(m), std: round(Math.sqrt(variance) || 1) };
  }
  const distances = rows.map(r => Math.sqrt(FEATURE_KEYS.reduce((s, k) => {
    const st = featureStats[k]; return s + (((Number(r[k]) - st.mean) / st.std) ** 2);
  }, 0)));
  const sorted = [...distances].sort((a, b) => a - b);
  const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.975))] || 3.5;
  const artifact = {
    schemaVersion: 'predictive-research-artifact-v2', version: PREDICTIVE_LAB_VERSION,
    createdAt: new Date().toISOString(), trainingRows: rows.length,
    featureKeys: FEATURE_KEYS, model, evaluation,
    calibration: { validated: false, method: 'validation-metrics-computed; explicit calibration review required', validationSampleCount: Number(evaluation?.validation?.sampleCount || 0), calibrationError: evaluation?.validation?.calibrationError ?? null },
    ood: { method: 'standardized_euclidean_distance', threshold: round(threshold, 2), featureStats },
    promotion: { allowed: false, reason: 'Research artifact only; explicit governance approval required.' },
  };
  artifact.digest = hash(artifact);
  return artifact;
}

export function saveResearchArtifact(artifact) {
  fs.mkdirSync(ML_ROOT, { recursive: true });
  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
  return ARTIFACT_PATH;
}

export function getResearchArtifactPath() { return ARTIFACT_PATH; }

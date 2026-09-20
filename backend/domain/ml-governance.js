import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ML_GOVERNANCE_VERSION = 'ml-governance-v1';
export const PRODUCTION_MODEL_STATUS = 'blocked_until_validated';

const REQUIRED_GATES = [
  ['dataProvenance', 'AUTHORIZED_REAL_DATA'],
  ['projectIdentifier', 'PROJECT_IDENTIFIER_VERIFIED'],
  ['outcomeDefinition', 'OUTCOME_DEFINITION_APPROVED'],
  ['temporalAvailability', 'PREDICTION_TIME_AVAILABILITY_VERIFIED'],
  ['temporalSplit', 'PROJECT_LEVEL_TEMPORAL_SPLIT'],
  ['leakage', 'ZERO_UNRESOLVED_LEAKAGE'],
  ['censoring', 'RIGHT_CENSORING_HANDLED'],
  ['evaluation', 'TEMPORAL_HOLDOUT_EVALUATED'],
  ['calibration', 'CALIBRATION_VALIDATED'],
  ['ood', 'OOD_APPLICABILITY_CHECKED'],
  ['provenance', 'ARTIFACT_PROVENANCE_RECORDED'],
  ['humanReview', 'HUMAN_REVIEW_COMPLETE']
];

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const mlRoot = path.join(root, 'backend', 'data', 'ml');

function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function bool(v) { return v === true || v === 1 || v === 'true' || v === 'PASS' || v === 'PASSED'; }

export function evaluatePromotionGate(input = {}) {
  const gates = {};
  for (const [key] of REQUIRED_GATES) gates[key] = bool(input[key]);
  const missing = REQUIRED_GATES.filter(([key]) => !gates[key]).map(([,label]) => label);
  return {
    version: ML_GOVERNANCE_VERSION,
    status: missing.length ? 'BLOCKED' : 'ELIGIBLE_FOR_HUMAN_APPROVAL',
    productionPromotionAllowed: missing.length === 0,
    gates,
    blockers: missing,
    note: missing.length
      ? 'Production promotion remains blocked until every evidence, temporal, evaluation, calibration and governance gate is satisfied.'
      : 'All technical gates are satisfied; explicit model approval is still required before production use.'
  };
}

export function buildReadinessFromForensics(forensics = null, mapping = null, outcome = null, split = null) {
  const files = Array.isArray(forensics?.files) ? forensics.files : [];
  const hasFiles = files.length > 0;
  const classifications = files.map(f => String(f.sourceClassification || '').toUpperCase());
  const explicitlyAuthorized = classifications.some(x => /AUTHORIZED|OFFICIAL_API|OFFICIAL_EXPORT/.test(x)) && !classifications.some(x => /USER_UPLOADED|UNVERIFIED|SYNTHETIC/.test(x));
  const sourceLooksSynthetic = files.length > 0 && files.every(f => String(f.file || '').toLowerCase().includes('synthetic') || classifications.some(x => x.includes('SYNTHETIC')));
  const realData = hasFiles && explicitlyAuthorized && !sourceLooksSynthetic;
  const project = Boolean(forensics?.files?.some(f => (f.grainClues?.possibleIdentifiers || []).some(x => /project/i.test(String(x))) || f.sheets?.some(s => (s.grain?.primaryProjectIdCandidate || {}).field)));
  const dates = Boolean(forensics?.files?.some(f => Object.keys(f.dateRanges || {}).length > 0 || f.sheets?.some(s => Object.keys(s.columns || {}).some(h => s.columns[h]?.type === 'date_or_datetime'))));
  const outcomeCandidate = Boolean(outcome?.candidates?.length || forensics?.files?.some(f => (f.labelFeasibility || []).length || f.sheets?.some(s => (s.labels?.candidateFields || []).length)));
  const mappingValid = mapping?.status === 'VALID_FOR_REVIEW';
  const splitReady = split?.mode === 'project_cohort_temporal' && split?.randomSplitRecommended === false;
  const gate = evaluatePromotionGate({
    dataProvenance: realData && mappingValid,
    projectIdentifier: project,
    outcomeDefinition: Boolean(outcome?.status === 'APPROVED'),
    temporalAvailability: dates,
    temporalSplit: splitReady,
    leakage: Boolean(forensics?.leakageViolations === 0 && forensics?.leakageAuditsClean !== false),
    censoring: Boolean(outcome?.rightCensoringRequired !== false),
    evaluation: false,
    calibration: false,
    ood: false,
    provenance: true,
    humanReview: false
  });
  return {
    generatedAt: new Date().toISOString(),
    governanceVersion: ML_GOVERNANCE_VERSION,
    modelStatus: PRODUCTION_MODEL_STATUS,
    datasetStatus: realData ? 'AUTHORIZED_REAL_DATA_DETECTED' : (hasFiles ? 'FILES_DETECTED_BUT_NOT_AUTHORIZED_FOR_PROMOTION' : 'NO_DATASET_FILES_DETECTED'),
    observed: { realData, projectIdentifierCandidate: project, dateCandidate: dates, outcomeCandidate, mappingValid, splitReady },
    gate,
    nextStep: realData
      ? 'Complete source/mapping/outcome review, build approved temporal cohorts, then train and evaluate.'
      : (hasFiles ? 'Files are present, but they remain unverified/user-uploaded until authoritative provenance and human approval are established. Do not promote them for production training.' : 'Place an authorized SIH26017-compatible dataset in backend/data/incoming or configure BHOOMI_FORENSICS_INPUT before training.')
  };
}

export function persistReadiness(readiness) {
  fs.mkdirSync(mlRoot, { recursive: true });
  const file = path.join(mlRoot, 'ML_READINESS_LATEST.json');
  const payload = { ...readiness, artifactSha256: sha256(readiness) };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

export function requiredProductionGates() { return REQUIRED_GATES.map(([, label]) => label); }

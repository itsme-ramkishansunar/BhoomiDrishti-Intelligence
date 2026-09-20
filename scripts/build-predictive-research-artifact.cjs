const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const input = process.env.BHOOMI_ML_TRAINING_INPUT || path.join(root, 'backend', 'data', 'prepared', 'sih26017_ml_ready.json');
const output = path.join(root, 'backend', 'data', 'ml', 'predictive-intelligence-v2.json');

function fail(message) { console.error(`PREDICTIVE RESEARCH BUILD BLOCKED: ${message}`); process.exit(2); }
if (!fs.existsSync(input)) fail(`reviewed ML dataset not found at ${path.relative(root, input)}.`);
let payload; try { payload = JSON.parse(fs.readFileSync(input, 'utf8')); } catch (e) { fail(`invalid JSON: ${e.message}`); }
if (payload.synthetic === true || String(payload.dataClass || '').toLowerCase() === 'synthetic') fail('synthetic data cannot be used for the research artifact.');
const rows = Array.isArray(payload.rows) ? payload.rows : payload;
if (!Array.isArray(rows) || rows.length < 10) fail('at least 10 reviewed rows are required.');
if (!rows.every(r => r && r.project_id && r.prediction_time && (Number(r.label) === 0 || Number(r.label) === 1))) fail('rows require project_id, prediction_time and binary label.');
const featureKeys = ['stage_index','days_in_stage','families_pending_ratio','legal_exposure','approval_gap','documentation_gap','rr_gap','administrative_friction'];
if (!featureKeys.every(k => rows.some(r => Number.isFinite(Number(r[k]))))) fail('required reviewed numeric features are missing.');
(async () => {
  const ml = await import('../backend/domain/ml-baseline.js');
  const lab = await import('../backend/domain/predictive-lab.js');
  const split = ml.projectTemporalSplit(rows);
  if (split.train.length < 5 || split.validation.length < 3 || split.test.length < 3) fail('temporal cohorts are too small for safe evaluation.');
  const model = ml.fitLogistic(split.train, featureKeys);
  const validation = ml.evaluateModel(model, split.validation);
  const test = ml.evaluateModel(model, split.test);
  const artifact = lab.buildResearchArtifact(rows, model, { validation, test, split: split.projects }, validation.sampleCount ? validation : []);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(artifact, null, 2));
  console.log(`Research artifact written: ${path.relative(root, output)}`);
  console.log(JSON.stringify({ version: artifact.version, trainingRows: artifact.trainingRows, validation, test, digest: artifact.digest, promotionAllowed: false }, null, 2));
})().catch(e => fail(e.message));

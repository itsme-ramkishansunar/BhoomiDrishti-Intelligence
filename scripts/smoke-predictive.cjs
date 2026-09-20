const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mustExist = [
  'backend/domain/predictive-engine.js',
  'database/migrations/004_predictive_intelligence.sql',
];
for (const file of mustExist) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing predictive file: ${file}`);
  console.log(`PASS file: ${file}`);
}
const engine = fs.readFileSync(path.join(root, 'backend/domain/predictive-engine.js'), 'utf8');
for (const token of ['buildPredictiveFeatures','candidate_not_validated','NOT_VALIDATED','leakage','expectedAdditionalDays','stageHazardPct','trajectory']) {
  if (!engine.toLowerCase().includes(token.toLowerCase())) throw new Error(`Missing predictive safeguard/token: ${token}`);
  console.log(`PASS predictive contract: ${token}`);
}
const migration = fs.readFileSync(path.join(root, 'database/migrations/004_predictive_intelligence.sql'), 'utf8');
for (const token of ['prediction_runs','prediction_feature_snapshots','predictive-baseline-v1']) {
  if (!migration.includes(token)) throw new Error(`Missing migration token: ${token}`);
  console.log(`PASS migration contract: ${token}`);
}
console.log('Predictive intelligence smoke source check passed.');

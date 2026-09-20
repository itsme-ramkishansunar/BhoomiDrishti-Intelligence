const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const must=[
 'backend/domain/temporal-dataset.js',
 'database/migrations/005_temporal_dataset.sql',
 'scripts/smoke-temporal-dataset.cjs',
];
for(const f of must){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing temporal dataset file: ${f}`);console.log(`PASS file: ${f}`);}
const engine=fs.readFileSync(path.join(root,'backend/domain/temporal-dataset.js'),'utf8');
for(const t of ['buildAsOfFeatureSnapshot','buildOutcome','FEATURE_AFTER_AS_OF','OUTCOME_FIELD_IN_FEATURES','right_censored_at_latest_available_snapshot','project_cohort_temporal','TEMPORAL_FEATURE_POLICY']){if(!engine.includes(t))throw new Error(`Missing temporal contract: ${t}`);console.log(`PASS temporal contract: ${t}`);}
const mig=fs.readFileSync(path.join(root,'database/migrations/005_temporal_dataset.sql'),'utf8');
for(const t of ['dataset_versions','temporal_examples','temporal_split_assignments','leakage_audits']){if(!mig.includes(t))throw new Error(`Missing migration contract: ${t}`);console.log(`PASS migration contract: ${t}`);}
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const t of ['/api/predictive/dataset/forensics','/api/predictive/dataset/build','/api/predictive/datasets/latest','/api/predictive/datasets/:id/examples','workflow:admin']){if(!server.includes(t))throw new Error(`Missing API contract: ${t}`);console.log(`PASS route contract: ${t}`);}
console.log('Temporal dataset smoke source check passed.');

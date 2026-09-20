const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DATA_ROOT_DIR, DB_PATH } = require('../backend/runtime-paths.cjs');
const { DatabaseSync } = require('node:sqlite');

(async () => {
  const root = process.cwd();
  const dbModuleUrl = pathToFileURL(path.join(root, 'backend', 'db.js')).href;
  await import(dbModuleUrl);
  const dataDir = DATA_ROOT_DIR;
  const dbPath = DB_PATH;
  const db = new DatabaseSync(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  const required = ['access_requests','audit_events','data_sources','project_stages','projects','roles','schema_migrations','users','project_stage_dependencies','legal_clock_snapshots','ai_sessions','ai_messages','ai_message_evidence','prediction_runs','prediction_feature_snapshots','project_intakes','project_intake_files','temporal_evidence_snapshots','temporal_evidence_events','source_connector_snapshots','data_ingestion_runs','officer_feedback','intervention_actions','prediction_diffs','operational_alerts','alert_events','model_monitoring_snapshots','replay_runs'];
  const missing = required.filter(t => !tables.includes(t));
  if (missing.length) {
    console.error('Database check failed. Missing tables:', missing.join(', '));
    process.exitCode = 1;
    db.close();
    return;
  }
  console.log(`Database check passed: ${dbPath}`);
  console.log(`Tables: ${required.length}/${required.length}`);
  console.log(`Projects: ${db.prepare('SELECT COUNT(*) AS n FROM projects').get().n}`);
  console.log(`Users: ${db.prepare('SELECT COUNT(*) AS n FROM users').get().n}`);
  console.log(`Access requests: ${db.prepare('SELECT COUNT(*) AS n FROM access_requests').get().n}`);
  console.log(`Officer feedback: ${db.prepare('SELECT COUNT(*) AS n FROM officer_feedback').get().n}`);
  console.log(`Intervention actions: ${db.prepare('SELECT COUNT(*) AS n FROM intervention_actions').get().n}`);
  console.log(`Prediction diffs: ${db.prepare('SELECT COUNT(*) AS n FROM prediction_diffs').get().n}`);
  console.log(`Operational alerts: ${db.prepare('SELECT COUNT(*) AS n FROM operational_alerts').get().n}`);
  console.log(`Alert events: ${db.prepare('SELECT COUNT(*) AS n FROM alert_events').get().n}`);
  console.log(`Model monitoring snapshots: ${db.prepare('SELECT COUNT(*) AS n FROM model_monitoring_snapshots').get().n}`);
  console.log(`Replay runs: ${db.prepare('SELECT COUNT(*) AS n FROM replay_runs').get().n}`);
  db.close();
})().catch(err => {
  console.error('Database check failed:', err);
  process.exitCode = 1;
});

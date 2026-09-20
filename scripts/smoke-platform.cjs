const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../backend/runtime-paths.cjs');

const root = process.cwd();
const requiredFiles = [
  'backend/server.js',
  'backend/db.js',
  'backend/domain/intelligence.js',
  'backend/domain/data-health.js',
  'backend/domain/workflows.js',
  'backend/domain/canonical-project.js',
  'backend/domain/unified-data-backbone.js',
  'database/migrations/014_unified_data_backbone.sql',
  'database/migrations/001_bhoomidrishti_core.sql',
  'database/migrations/007_canonical_project.sql',
  'database/migrations/009_source_connector_snapshots.sql',
  'database/migrations/010_data_ingestion_runs.sql',
  'scripts/check-db.cjs',
  'scripts/check-text.cjs',
  'scripts/smoke-ai.cjs',
  'scripts/smoke-ai-conversation.cjs',
  'database/migrations/003_ai_conversations.sql',
  'database/migrations/004_predictive_intelligence.sql',
  'backend/domain/predictive-engine.js',
  'scripts/smoke-predictive.cjs',
  'src/App.jsx',
  'src/components/project/PredictiveIntelligencePanel.jsx',
];

const checks = [];
for (const rel of requiredFiles) checks.push([`file: ${rel}`, fs.existsSync(path.join(root, rel))]);

const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const dbPath = DB_PATH;
const db = new DatabaseSync(dbPath);
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
for (const table of ['legal_frameworks','workflow_templates','workflow_stages','project_events','data_snapshots','data_lineage','project_parcels','predictions','prediction_explanations','recommendations','interventions','alerts','model_registry','model_evaluations','project_stage_dependencies','legal_clock_snapshots','ai_sessions','ai_messages','ai_message_evidence','prediction_runs','prediction_feature_snapshots','canonical_project_records','canonical_project_entities','project_data_facts','project_intelligence_snapshots']) {
  checks.push([`db table: ${table}`, tables.has(table)]);
}

db.close();
checks.push(['backend: authentication middleware', /function requireAuth\(/.test(server)]);
checks.push(['backend: project authorization', /isProjectAuthorised/.test(server)]);
checks.push(['backend: AI route', /app\.post\('\/api\/ai\/chat'/.test(server)]);
checks.push(['backend: AI session routes', /app\.get\('\/api\/ai\/sessions'/.test(server) && /app\.get\('\/api\/ai\/sessions\/:id'/.test(server)]);
checks.push(['backend: AI evidence lineage', /listAIMessageEvidence/.test(server) && /evidenceRefs/.test(server)]);
checks.push(['backend: workflow/rules route', /app\.get\('\/api\/rules'/.test(server)]);
checks.push(['backend: project workflow route', /\/api\/projects\/:id\/workflow/.test(server)]);
checks.push(['backend: legal clock route', /\/api\/projects\/:id\/legal-clocks/.test(server)]);
checks.push(['backend: project event write route', /\/api\/projects\/:id\/events/.test(server)]);
checks.push(['backend: legal engine', fs.existsSync(path.join(root,'backend/domain/legal-engine.js'))]);
checks.push(['frontend: workflow/legal clock panel', /Workflow & legal clock status/.test(require('node:fs').readFileSync(path.join(root,'src/components/project/ProjectOpsPanel.jsx'),'utf8'))]);
checks.push(['frontend: stored-risk wording', /stored risk score \· not a validated probability/.test(app)]);
checks.push(['backend: prediction route', /\/predictions/.test(server)]);
checks.push(['backend: predictive intelligence routes', /\/api\/projects\/:id\/predictive-intelligence/.test(server) && /\/api\/predictive\/portfolio/.test(server)]);
checks.push(['backend: predictive persistence', /persistCandidatePrediction/.test(server) && /createPredictionRun/.test(server)]);
checks.push(['frontend: predictive intelligence panel', /PredictiveIntelligencePanel/.test(app) && /candidate forecast/i.test(fs.readFileSync(path.join(root,'src/components/project/PredictiveIntelligencePanel.jsx'),'utf8'))]);
checks.push(['frontend: project AI entry point', /openProjectAI/.test(app) && /Ask Bhoomi AI/.test(app)]);
const aiPage = fs.readFileSync(path.join(root,'src/components/ai/BhoomiAIPage.jsx'),'utf8');
checks.push(['frontend: persisted AI session', /\/api\/ai\/sessions/.test(aiPage) && /sessionId/.test(aiPage) && /Conversation saved server-side/.test(aiPage)]);
checks.push(['frontend: project detail', /ProjectDetail/.test(app)]);
checks.push(['backend: source connector routes', /\/api\/source-connectors\/catalog/.test(server) && /\/api\/source-connectors\/:id\/sync/.test(server)]);
checks.push(['backend: dataset ingestion routes', /\/api\/data-ingestion\/upload/.test(server) && /\/api\/data-ingestion\/runs/.test(server)]);
checks.push(['frontend: dataset intake control', /Authorized dataset intake/.test(fs.readFileSync(path.join(root,'src/components/ops/DataHealthPage.jsx'),'utf8'))]);
checks.push(['backend: intelligence trust route', /\/api\/projects\/:id\/intelligence-trust/.test(server) && /calculateEvidenceReadiness/.test(server)]);
checks.push(['backend: intelligence trust domain', fs.existsSync(path.join(root,'backend/domain/intelligence-trust.js'))]);
checks.push(['backend: unified data hub route', /\/api\/projects\/:id\/data-hub/.test(server) && /getProjectDataHub/.test(server)]);
checks.push(['backend: unified data refresh route', /\/api\/projects\/:id\/data-hub\/refresh/.test(server) && /refreshUnifiedProjectSnapshot/.test(server)]);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`Platform smoke source/schema check failed: ${failed} checks failed.`);
  process.exit(1);
}
console.log(`Platform smoke source/schema check passed: ${checks.length} checks.`);

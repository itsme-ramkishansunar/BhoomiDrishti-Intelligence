const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root,'database/migrations/014_unified_data_backbone.sql'),'utf8');
const domain = fs.readFileSync(path.join(root,'backend/domain/unified-data-backbone.js'),'utf8');
const server = fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const dbSource = fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const staticChecks = [
  ['backbone version', /UNIFIED_DATA_BACKBONE_VERSION/.test(domain) && /unified-data-backbone-v1/.test(domain)],
  ['facts table migration', /CREATE TABLE IF NOT EXISTS project_data_facts/.test(migration)],
  ['snapshot table migration', /CREATE TABLE IF NOT EXISTS project_intelligence_snapshots/.test(migration)],
  ['facts sync', /export function syncProjectDataFacts/.test(dbSource)],
  ['facts provenance', /classifySourceLabel\(sourceLabel\)/.test(dbSource)],
  ['snapshot upsert', /export function upsertProjectIntelligenceSnapshot/.test(dbSource)],
  ['data hub read route', /\/api\/projects\/:id\/data-hub/.test(server) && /getUnifiedProjectDataHub/.test(server)],
  ['data hub refresh route', /\/api\/projects\/:id\/data-hub\/refresh/.test(server) && /refreshUnifiedProjectSnapshot/.test(server)],
  ['manual project bootstrap', /buildProjectBootstrap\(project/.test(server) && /refreshUnifiedProjectSnapshot\(project/.test(server)],
  ['intake project bootstrap', /buildProjectBootstrap\(saved/.test(server) && /refreshUnifiedProjectSnapshot\(saved/.test(server)],
  ['evidence exposes normalized facts', /dataFacts:getProjectDataFacts/.test(server)],
  ['validate script registered', pkg.scripts && pkg.scripts['smoke:unified-data-backbone'] === 'node scripts/smoke-unified-data-backbone.cjs'],
];

for (const [label, ok] of staticChecks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} unified-data-backbone: ${label}`);
  if (!ok) process.exitCode = 1;
}
if (process.exitCode) process.exit(1);

const temp = fs.mkdtempSync(path.join(os.tmpdir(),'bhoomidrishti-u51-'));
process.env.BHOOMI_STORAGE_MODE = 'isolated';
process.env.BHOOMI_ALLOW_CUSTOM_STORAGE = 'true';
process.env.BHOOMI_DATA_DIR = temp;
process.env.BHOOMI_DB_PATH = path.join(temp,'unified.sqlite');

(async()=>{
  const db = await import('../backend/db.js');
  const domainMod = await import('../backend/domain/unified-data-backbone.js');
  const projects = db.listProjects();
  if (!projects.length) throw new Error('Behavior check found no seeded projects.');
  const project = projects[0];
  const facts = db.syncProjectDataFacts(project, 'u51-smoke');
  if (facts.length < 10) throw new Error(`Expected normalized facts, got ${facts.length}.`);
  const provenance = facts.find(x=>x.factKey==='name')?.provenanceStatus;
  if (provenance !== 'SYNTHETIC') throw new Error(`Expected seed provenance SYNTHETIC, got ${provenance}.`);
  const snapshot = domainMod.refreshUnifiedProjectSnapshot(project,{generatedBy:'u51-smoke'});
  if (!snapshot?.dataSha256 || snapshot.dataSha256.length !== 64) throw new Error('Unified snapshot hash missing/invalid.');
  const hub = db.getProjectDataHub(project.id);
  if (hub?.project?.id !== project.id) throw new Error('Unified data hub project mismatch.');
  if (!Array.isArray(hub.facts) || hub.facts.length < 10) throw new Error('Unified data hub facts missing.');
  if (!hub.snapshot || hub.snapshot.projectId !== project.id) throw new Error('Unified snapshot not persisted.');
  console.log(`PASS unified-data-backbone: behavior (project=${project.id}, facts=${facts.length}, snapshotVersion=${snapshot.snapshotVersion})`);
  db.close();
  try { fs.rmSync(temp,{recursive:true,force:true}); } catch (_) {}
  console.log('Unified data backbone behavior check PASSED');
})().catch(error=>{
  console.error(`ERROR unified-data-backbone behavior: ${error?.stack || error}`);
  try { if (db?.close) db.close(); } catch (_) {}
  try { fs.rmSync(temp,{recursive:true,force:true}); } catch (_) {}
  process.exit(1);
});

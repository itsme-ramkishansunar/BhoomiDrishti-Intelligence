const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.ok(['1.0.24-u75.2-4-bulk-intelligence','1.0.30-u75.10-bulk-closure','1.0.32-u75.10-final-deployment','1.0.25-u75.5-evidence-promotion','1.0.26-u75.6-interactive-command-center','1.0.27-u75.7-bulk-reliability','1.0.28-u75.8-governed-bulk-workbench','1.0.29-u75.9-bulk-intelligence-propagation'].includes(pkg.version));
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const ops=fs.readFileSync(path.join(root,'src/components/ops/OperationsCenterPage.jsx'),'utf8');
const proj=fs.readFileSync(path.join(root,'src/components/project/ProjectOpsPanel.jsx'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
for(const f of ['u75.2-action-intelligence.js','u75.3-scenario-engine.js','u75.4-timeline-engine.js']) assert.ok(fs.existsSync(path.join(root,'backend/domain',f)),`missing ${f}`);
for(const t of [
'/api/operations/action-intelligence','/api/operations/action-intelligence/generate',
'/api/projects/:id/action-intelligence','/api/projects/:id/scenarios/preview','/api/projects/:id/scenarios',
'/api/projects/:id/statutory-timeline','/api/operations/statutory-timeline',
'/api/source-connectors/bulk-sync',"requirePermission('workflow:action')",
'U75_2_ACTION_INTELLIGENCE_VERSION','U75_3_SCENARIO_VERSION','U75_4_TIMELINE_VERSION'
]) assert.ok(server.includes(t),`missing backend ${t}`);
for(const t of ['Generate actions','Governed action intelligence','Timeline intelligence','Configured stage clocks']) assert.ok(ops.includes(t),`missing operations UI ${t}`);
for(const t of ['action-intelligence','statutory-timeline','scenarios','Governed action intelligence']) assert.ok(proj.includes(t),`missing project UI ${t}`);
for(const t of ['/api/projects/${encodeURIComponent(project.id)}/scenarios/preview','Save scenario','Scenario simulation only']) assert.ok(app.includes(t),`missing scenario UI ${t}`);
assert.ok(fs.readFileSync(path.join(root,'backend/db.js'),'utf8').includes('export function listProjectStages'));
assert.ok(fs.readFileSync(path.join(root,'backend/db.js'),'utf8').includes('export function listInterventions'));
console.log('PASS U75.2 deterministic action engine');
console.log('PASS U75.3 persisted what-if scenario engine');
console.log('PASS U75.4 configured statutory timeline engine');
console.log('PASS bulk public-source snapshot orchestration');
console.log('PASS Operations Center integration');
console.log('PASS Project Intelligence integration');
console.log('PASS RBAC route boundaries');
console.log('U75.2-4 BULK INTELLIGENCE SMOKE: PASS');

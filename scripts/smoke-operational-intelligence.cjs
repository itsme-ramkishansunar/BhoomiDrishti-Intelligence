const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['backend/domain/operational-intelligence.js','database/migrations/013_operational_intelligence.sql','src/components/ops/OperationsCenterPage.jsx','backend/server.js'];
for(const f of files){if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing operational intelligence file: ${f}`);}
const domain=fs.readFileSync(path.join(root,'backend/domain/operational-intelligence.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'database/migrations/013_operational_intelligence.sql'),'utf8');
for(const token of ['buildEarlyWarning','warningWindowStatus','NOT_AVAILABLE','operational-intelligence-v1']) if(!domain.includes(token)) throw new Error(`Missing domain contract: ${token}`);
for(const token of ['/api/operations/overview','/api/alerts/generate','/api/ml/monitoring','/api/projects/:id/replay']) if(!server.includes(token)) throw new Error(`Missing route: ${token}`);
for(const token of ['operational_alerts','alert_events','model_monitoring_snapshots','replay_runs']) if(!migration.includes(token)) throw new Error(`Missing table: ${token}`);
console.log('Operational intelligence smoke source contract PASSED');

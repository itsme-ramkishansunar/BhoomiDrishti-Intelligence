const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..'); const s=fs.readFileSync(path.join(root,'backend/domain/operational-intelligence.js'),'utf8');
for(const t of ['buildModelMonitoringStatus','productionPromotionAllowed','latestSnapshot','required']) if(!s.includes(t)) throw new Error(`Missing MLOps domain token: ${t}`);
const migration=fs.readFileSync(path.join(root,'database/migrations/013_operational_intelligence.sql'),'utf8');
for(const t of ['calibration_error','ood_rate','drift_status']) if(!migration.includes(t)) throw new Error(`Missing MLOps metric column: ${t}`);
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
if(!server.includes("app.get('/api/ml/monitoring'")) throw new Error('MLOps monitoring route missing.');
if(!server.includes("app.post('/api/ml/monitoring/snapshot'")) throw new Error('MLOps snapshot route missing.');
console.log('MLOps smoke source contract PASSED');

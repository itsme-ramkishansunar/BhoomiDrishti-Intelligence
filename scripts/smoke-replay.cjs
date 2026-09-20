const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'database/migrations/013_operational_intelligence.sql'),'utf8');
for(const t of ['replay_runs','snapshot_count','event_count','prediction_count','outcome_count']) if(!migration.includes(t)) throw new Error(`Missing replay contract: ${t}`);
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const t of ["app.get('/api/projects/:id/replay'","app.post('/api/projects/:id/replay'"]) if(!server.includes(t)) throw new Error(`Missing replay route: ${t}`);
console.log('Replay smoke source contract PASSED');

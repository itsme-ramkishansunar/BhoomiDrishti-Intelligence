const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const domain=fs.readFileSync(path.join(root,'backend/domain/temporal-reconciliation.js'),'utf8');
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const db=fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'database/migrations/008_temporal_evidence.sql'),'utf8');
for(const t of ['reconcileTemporalEvidence','temporal-evidence-v1','MULTIPLE_DATES','CHRONOLOGY_INVERSION','futureExcluded','snapshotSha256','availabilityPolicy']){if(!domain.includes(t))throw new Error(`Missing temporal reconciliation contract: ${t}`); console.log(`PASS temporal-reconciliation contract: ${t}`)}
for(const t of ['/api/project-intake/:id/temporal-reconcile','/api/project-intake/:id/temporal-snapshot','reconcileTemporalEvidence']){if(!server.includes(t))throw new Error(`Missing temporal server contract: ${t}`); console.log(`PASS temporal server contract: ${t}`)}
for(const t of ['temporal_evidence_snapshots','temporal_evidence_events','createTemporalEvidenceSnapshot','getTemporalEvidenceSnapshot','getLatestTemporalEvidenceSnapshot']){if(!db.includes(t))throw new Error(`Missing temporal DB contract: ${t}`); console.log(`PASS temporal DB contract: ${t}`)}
for(const t of ['temporal_evidence_snapshots','temporal_evidence_events','snapshot_sha256','as_of']){if(!migration.includes(t))throw new Error(`Missing migration contract: ${t}`); console.log(`PASS temporal migration contract: ${t}`)}
const mod=domain.replaceAll('export function','function');

(async()=>{
  try {
    const modPath=require('node:url').pathToFileURL(path.join(root,'backend/domain/temporal-reconciliation.js')).href;
    const {reconcileTemporalEvidence}=await import(modPath);
    const canonical={timeline:[{key:'proposal',label:'Proposal',isoDate:'2026-01-01T00:00:00Z',document:'a.pdf'},{key:'notification',label:'Notification',isoDate:'2026-02-01T00:00:00Z',document:'a.pdf'},{key:'notification',label:'Notification',isoDate:'2026-02-10T00:00:00Z',document:'b.pdf'}]};
    const asOf=reconcileTemporalEvidence({canonical,asOf:'2026-02-05T00:00:00Z'});
    const conflict=reconcileTemporalEvidence({canonical,asOf:'2026-02-20T00:00:00Z'});
    if(asOf.events.length!==2||asOf.futureExcludedCount!==1||conflict.conflicts.length!==1||!asOf.snapshotSha256) throw new Error('Temporal reconciliation behavior check failed');
    console.log('PASS temporal behavior: as-of filtering, conflict detection, snapshot hashing');
    console.log('Temporal reconciliation smoke source/behavior check passed.');
  } catch(e){ console.error(e.message); process.exit(1); }
})();

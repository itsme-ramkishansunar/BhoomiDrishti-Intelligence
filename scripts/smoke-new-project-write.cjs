const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bhoomidrishti-u50-write-'));
  process.env.BHOOMI_STORAGE_MODE = 'isolated';
  process.env.BHOOMI_ALLOW_CUSTOM_STORAGE = 'true';
  process.env.BHOOMI_DATA_DIR = path.join(tempRoot, 'data');
  process.env.BHOOMI_DB_PATH = path.join(tempRoot, 'data', 'test.sqlite');
  try {
    const db = await import('../backend/db.js');
    const actor = { email: 'smoke@example.local', role: 'Administrator', id: 'smoke-admin' };
    const code = `WRITE-${Date.now()}`;
    const project = db.upsertProject({
      name: 'U50 New Project Write Test', code,
      type: 'Highway', state: 'Tamil Nadu', district: 'Salem', status: 'ongoing',
      totalParcels: 200, parcelsAcquired: 50, familiesAffected: 100, familiesPending: 80,
      avgDelayDays: 90, disputes: 8, courtCases: 3, approvalPct: 35, docsMissing: 30,
      resettlementPct: 25, rehabPct: 20, depts: 6, prevDelays: 3, stageIndex: 4
    }, actor);
    if (!project?.id || project.name !== 'U50 New Project Write Test') throw new Error('New project write did not return a persisted project.');
    const persisted = db.getProject(project.id);
    if (!persisted || persisted.code !== code) throw new Error('New project was not readable after write.');
    if (!Number.isFinite(persisted.risk?.overall)) throw new Error('Server-side risk was not calculated for the new project.');
    console.log('PASS new-project write: projects INSERT placeholder/parameter alignment');
    console.log('PASS new-project write: persisted project retrieval');
    console.log('PASS new-project write: automatic risk calculation');
    console.log('New project write smoke PASSED');
  } finally {
    try {
      const db = await import('../backend/db.js');
      if (typeof db.close === 'function') db.close();
    } catch {}
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(`ERROR: ${error?.message || error}`); process.exitCode = 1; });

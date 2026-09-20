'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync, backup } = require('node:sqlite');
const { DATA_ROOT_DIR, DB_PATH, PERSISTENCE_MANIFEST_PATH, ensureRuntimeDirs } = require('../backend/runtime-paths.cjs');

function timestamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function countProjects(db) {
  try { return Number(db.prepare('SELECT COUNT(*) n FROM projects').get()?.n ?? 0); } catch (_) { return 0; }
}
function tryReadWrite() {
  try {
    const db = new DatabaseSync(DB_PATH, { timeout: 5000 });
    try { db.prepare('SELECT 1').get(); db.exec('BEGIN IMMEDIATE; ROLLBACK;'); }
    finally { db.close(); }
    return true;
  } catch (_) { return false; }
}
function openReadOnly() {
  return new DatabaseSync(DB_PATH, { readOnly: true, timeout: 5000 });
}

(async () => {
  ensureRuntimeDirs();
  if (!fs.existsSync(DB_PATH)) {
    console.log(`No shared database exists yet: ${DB_PATH}`);
    console.log('Nothing to repair; the application will create it on first start.');
    process.exit(0);
  }

  if (tryReadWrite()) {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const projects = countProjects(db); db.close();
    console.log(`Persistent database is already read/write healthy (${projects} projects). No repair needed.`);
    process.exit(0);
  }

  let source;
  try {
    source = openReadOnly();
  } catch (error) {
    console.error(`FAIL: persistent database cannot be opened even read-only: ${error.message}`);
    console.error('Stop all BHOOMIDHRISHTI instances and run this command again. No database files were modified.');
    process.exit(1);
  }

  const projects = countProjects(source);
  const backupDir = path.join(DATA_ROOT_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = timestamp();
  const originalBackup = path.join(backupDir, `bhoomidrishti.sqlite.before-repair-${stamp}.bak`);
  const cleanTemp = path.join(DATA_ROOT_DIR, `.bhoomidrishti.repair-${process.pid}-${Date.now()}.sqlite`);

  try {
    console.log(`Read-only database is accessible (${projects} projects). Creating a clean SQLite backup before repair.`);
    await backup(source, cleanTemp, { rate: 100 });
    source.close(); source = null;

    if (!fs.existsSync(cleanTemp)) throw new Error('clean backup file was not created');

    // Validate the rebuilt database before touching the live path.
    const rebuilt = new DatabaseSync(cleanTemp, { timeout: 5000 });
    try {
      rebuilt.prepare('SELECT 1').get();
      rebuilt.exec('BEGIN IMMEDIATE; ROLLBACK;');
      const rebuiltProjects = countProjects(rebuilt);
      if (rebuiltProjects !== projects) throw new Error(`project count changed during repair (${projects} -> ${rebuiltProjects})`);
    } finally { rebuilt.close(); }

    // Preserve the exact pre-repair main database. WAL/SHM sidecars are moved aside too.
    fs.renameSync(DB_PATH, originalBackup);
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${DB_PATH}${suffix}`;
      if (fs.existsSync(sidecar)) {
        fs.renameSync(sidecar, `${originalBackup}${suffix}`);
      }
    }
    fs.renameSync(cleanTemp, DB_PATH);

    const manifest = fs.existsSync(PERSISTENCE_MANIFEST_PATH)
      ? JSON.parse(fs.readFileSync(PERSISTENCE_MANIFEST_PATH, 'utf8'))
      : {};
    manifest.lastRepairAt = new Date().toISOString();
    manifest.lastRepairReason = 'read-only persistent database repaired via SQLite online backup';
    manifest.lastRepairBackup = originalBackup;
    fs.writeFileSync(PERSISTENCE_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`Repair complete. Projects preserved: ${projects}`);
    console.log(`Original database backup: ${originalBackup}`);
    console.log(`Repaired database: ${DB_PATH}`);

    // Final write-open verification.
    const finalDb = new DatabaseSync(DB_PATH, { timeout: 10000 });
    try { finalDb.exec('BEGIN IMMEDIATE; ROLLBACK;'); }
    finally { finalDb.close(); }
    console.log('PASS: repaired persistent database is read/write accessible.');
  } catch (error) {
    try { if (source) source.close(); } catch (_) {}
    try { if (fs.existsSync(cleanTemp)) fs.unlinkSync(cleanTemp); } catch (_) {}
    console.error(`FAIL: persistent-store repair aborted: ${error.message}`);
    console.error('The original database was preserved unless the live-path swap had already completed.');
    process.exit(1);
  }
})().catch(error => {
  console.error(`FAIL: unexpected persistent-store repair error: ${error.message}`);
  process.exit(1);
});

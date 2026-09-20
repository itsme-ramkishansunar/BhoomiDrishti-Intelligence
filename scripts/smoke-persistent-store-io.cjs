'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ensureRuntimeDirs, DATA_ROOT_DIR, DB_PATH, PERSISTENCE_MANIFEST_PATH } = require('../backend/runtime-paths.cjs');

function fail(message) {
  console.error(`FAIL persistence-io: ${message}`);
  process.exit(1);
}

try {
  ensureRuntimeDirs();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.accessSync(DATA_ROOT_DIR, fs.constants.R_OK | fs.constants.W_OK);

  const db = new DatabaseSync(DB_PATH, { timeout: 10000 });
  try {
    const check = db.prepare('PRAGMA quick_check;').get();
    const value = String(check?.quick_check ?? check?.['quick_check'] ?? '').toLowerCase();
    if (value !== 'ok') fail(`SQLite quick_check returned ${value || 'unknown'}`);

    // Prove the current process can obtain a write transaction without changing data.
    db.exec('BEGIN IMMEDIATE; ROLLBACK;');

    const projects = Number(db.prepare('SELECT COUNT(*) n FROM projects').get()?.n ?? 0);
    console.log(`PASS persistence-io: read/write database opened (${projects} projects)`);
  } finally {
    db.close();
  }

  if (!fs.existsSync(PERSISTENCE_MANIFEST_PATH)) fail('persistence manifest is missing');
  console.log('Persistent-store read/write I/O smoke passed.');
} catch (error) {
  fail(error?.message || String(error));
}

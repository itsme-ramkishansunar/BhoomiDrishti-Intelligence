'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = [
  'backend/db.js',
  'backend/runtime-paths.cjs',
  'scripts/start-local-all.cjs',
  'scripts/repair-persistent-store.cjs',
  'scripts/smoke-persistent-store-io.cjs',
  'scripts/migrate-persistent-store.cjs',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error(`missing runtime hardening file: ${file}`);
}
const start = fs.readFileSync(path.join(root,'scripts/start-local-all.cjs'),'utf8');
if (!start.includes('Persistent DB preflight: PASS')) throw new Error('startup preflight contract missing');
if (!start.includes('RUNTIME_LOCK_PATH') && !start.includes('.bhoomidrishti-runtime.lock')) throw new Error('single-instance lock contract missing');
const repair = fs.readFileSync(path.join(root,'scripts/repair-persistent-store.cjs'),'utf8');
if (!repair.includes('backup(source')) throw new Error('SQLite online-backup repair contract missing');
const db = fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
if (!db.includes('timeout: 10000')) throw new Error('database open timeout contract missing');
console.log('U53.1 runtime hardening smoke PASSED');

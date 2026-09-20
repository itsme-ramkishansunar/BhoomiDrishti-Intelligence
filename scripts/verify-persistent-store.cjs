'use strict';
const fs=require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const {DATA_ROOT_DIR,DB_PATH,PERSISTENCE_MANIFEST_PATH,STORAGE_MODE}=require('../backend/runtime-paths.cjs');
if(!fs.existsSync(DB_PATH)) { console.error(`FAIL: persistent database not found: ${DB_PATH}`); process.exit(1); }
const db=new DatabaseSync(DB_PATH,{timeout:10000});
let projects=0, users=0;
try { db.exec('BEGIN IMMEDIATE; ROLLBACK;'); } catch(e) { console.error(`FAIL: persistent database is not writable: ${e.message}`); process.exit(1); }
try { projects=Number(db.prepare('SELECT COUNT(*) n FROM projects').get().n||0); } catch(_) {}
try { users=Number(db.prepare('SELECT COUNT(*) n FROM users').get().n||0); } catch(_) {}
try { const qc=db.prepare('PRAGMA quick_check;').get(); const value=String(qc?.quick_check ?? '').toLowerCase(); if(value!=='ok'){ console.error(`FAIL: SQLite quick_check returned ${value||'unknown'}`); process.exit(1); } } catch(e) { console.error(`FAIL: SQLite quick_check failed: ${e.message}`); process.exit(1); }
const manifest=fs.existsSync(PERSISTENCE_MANIFEST_PATH)?JSON.parse(fs.readFileSync(PERSISTENCE_MANIFEST_PATH,'utf8')):null;
console.log(`Persistent store: ${DATA_ROOT_DIR}`);
console.log(`Database: ${DB_PATH}`);
console.log(`Storage mode: ${STORAGE_MODE}`);
console.log(`Projects: ${projects}`);
console.log(`Users: ${users}`);
if(!manifest) { console.error('FAIL: storage-manifest.json is missing.'); process.exit(1); }
console.log('PASS: persistent store is readable and has a manifest.');

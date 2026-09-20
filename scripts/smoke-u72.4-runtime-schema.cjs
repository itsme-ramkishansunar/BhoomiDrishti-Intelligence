'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../backend/runtime-paths.cjs');
if (!fs.existsSync(DB_PATH)) {
  console.error(JSON.stringify({ok:false,error:'Persistent database not found',dbPath:DB_PATH},null,2));
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH, { readOnly: true });
const cols = new Set(db.prepare('PRAGMA table_info(projects)').all().map(r => String(r.name)));
const required = ['portfolio_status','archived_at','archived_by','archive_reason','responsible_department'];
const missing = required.filter(c => !cols.has(c));
const intake = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='intake_field_reviews'").get());
const result = {ok: missing.length===0 && intake, checks:6, database:DB_PATH, missingProjectColumns:missing, intakeFieldReviews:intake, destructiveMigration:false};
console.log(JSON.stringify(result,null,2));
db.close();
if (!result.ok) process.exit(1);

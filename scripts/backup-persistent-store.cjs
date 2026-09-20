'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync,backup}=require('node:sqlite');
const {DB_PATH,PERSISTENT_BACKUP_DIR}=require('../backend/runtime-paths.cjs');
(async()=>{
  if(!fs.existsSync(DB_PATH)) { console.log(`No persistent database exists yet: ${DB_PATH}`); process.exit(0); }
  fs.mkdirSync(PERSISTENT_BACKUP_DIR,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const out=path.join(PERSISTENT_BACKUP_DIR,`bhoomidrishti.before-u56.2-${stamp}.sqlite`);
  const source=new DatabaseSync(DB_PATH,{readOnly:true,timeout:10000});
  try { await backup(source,out,{rate:100}); }
  finally { source.close(); }
  const check=new DatabaseSync(out,{readOnly:true,timeout:10000});
  try {
    const projects=Number(check.prepare('SELECT COUNT(*) n FROM projects').get().n||0);
    console.log(`Backup complete: ${out}`);
    console.log(`Projects preserved: ${projects}`);
  } finally { check.close(); }
})().catch(e=>{console.error(`Persistent-store backup failed: ${e.message}`);process.exit(1);});

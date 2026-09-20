'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const { DatabaseSync, backup }=require('node:sqlite');
const {PROJECT_ROOT, DEFAULT_PERSISTENT_DATA_ROOT, DB_PATH, DATA_ROOT_DIR}=require('../backend/runtime-paths.cjs');

const downloads=path.join(os.homedir(),'Downloads');
const candidateRoots=new Set([PROJECT_ROOT]);
if(fs.existsSync(downloads)) {
  for(const name of fs.readdirSync(downloads)) {
    if(!/^BHOOMIDHRISHTI_UPGRADE_/i.test(name)) continue;
    const full=path.join(downloads,name);
    if(fs.existsSync(full)&&fs.statSync(full).isDirectory()) candidateRoots.add(full);
  }
}
function findDb(root){
  const direct=path.join(root,'backend','data','bhoomidrishti.sqlite');
  if(fs.existsSync(direct)) return direct;
  const stack=[root];
  while(stack.length){
    const d=stack.pop();
    let ents=[]; try{ents=fs.readdirSync(d,{withFileTypes:true});}catch(_){continue;}
    for(const e of ents){
      if(['node_modules','.git','dist'].includes(e.name)) continue;
      const f=path.join(d,e.name);
      if(e.isDirectory()) stack.push(f);
      else if(e.name==='bhoomidrishti.sqlite' && /backend[\\/]data/.test(f.replaceAll('\\','/'))) return f;
    }
  }
  return null;
}
function inspect(dbPath){
  try {
    const db=new DatabaseSync(dbPath,{readOnly:true,timeout:5000});
    const projects=Number(db.prepare('SELECT COUNT(*) n FROM projects').get().n||0);
    let latest=0; try{ latest=Date.parse(db.prepare("SELECT COALESCE(MAX(updated_at), '') v FROM projects").get().v||'')||0; }catch(_){ }
    db.close(); return {projects,latest};
  } catch(e) { return null; }
}

(async()=>{
  if(DEFAULT_PERSISTENT_DATA_ROOT===PROJECT_ROOT || DATA_ROOT_DIR.startsWith(PROJECT_ROOT + path.sep)) {
    console.error('FAIL: persistent store resolved inside the release. Refusing migration.'); process.exit(1);
  }
  if(fs.existsSync(DB_PATH)) {
    console.log(`Persistent store already exists: ${DB_PATH}`);
    console.log('Applying/repairing pending idempotent schema migrations in the existing shared store.');
    const dbModule = await import('../backend/db.js');
    try {
      const { BULK_FEATURE_REGISTRY_VERSION } = await import('../backend/domain/bulk-features.js');
      console.log(`Schema verification complete: ${BULK_FEATURE_REGISTRY_VERSION}`);
    } finally { dbModule.close(); }
    console.log('Existing project data preserved.');
    process.exit(0);
  }

  const candidates=[];
  for(const root of candidateRoots){
    const db=findDb(root); if(!db || path.resolve(db)===path.resolve(DB_PATH)) continue;
    const info=inspect(db); if(info) candidates.push({root,db,...info,mtime:fs.statSync(db).mtimeMs});
  }
  if(!candidates.length){
    fs.mkdirSync(DATA_ROOT_DIR,{recursive:true});
    console.log('No legacy project database found. The persistent store will be created on first application start.');
    process.exit(0);
  }
  candidates.sort((a,b)=>b.projects-a.projects||b.latest-a.latest||b.mtime-a.mtime);
  console.log('Candidate legacy stores:');
  for(const c of candidates.slice(0,10)) console.log(`  ${c.projects} projects | ${c.db}`);
  const chosen=candidates[0];
  console.log(`Selected source: ${chosen.db}`);
  console.log('SOURCE DATABASE IS NOT MODIFIED.');
  console.log('Stop all BHOOMIDHRISHTI servers before continuing.');

  if (fs.existsSync(DATA_ROOT_DIR)) {
    const existing=fs.readdirSync(DATA_ROOT_DIR);
    if(existing.length>0){
      console.error(`FAIL: shared persistent data root already contains files but has no database: ${DATA_ROOT_DIR}`);
      console.error('Refusing to merge or overwrite automatically. Preserve the directory and resolve it explicitly.');
      process.exit(1);
    }
  } else fs.mkdirSync(DATA_ROOT_DIR,{recursive:true});

  const tempDb=path.join(DATA_ROOT_DIR,`.migration-${Date.now()}.sqlite`);
  const source=new DatabaseSync(chosen.db,{readOnly:true,timeout:10000});
  try {
    await backup(source,tempDb,{rate:100});
  } finally { source.close(); }

  const rebuilt=new DatabaseSync(tempDb,{timeout:10000});
  try {
    rebuilt.exec('BEGIN IMMEDIATE; ROLLBACK;');
    const projects=Number(rebuilt.prepare('SELECT COUNT(*) n FROM projects').get().n||0);
    if(projects!==chosen.projects) throw new Error(`project count changed during migration (${chosen.projects} -> ${projects})`);
  } finally { rebuilt.close(); }

  // Copy non-database runtime data, but intentionally never copy SQLite -wal/-shm sidecars.
  const sourceDataDir=path.dirname(chosen.db);
  const parent=path.dirname(DB_PATH);
  for(const name of fs.readdirSync(sourceDataDir)){
    if(['bhoomidrishti.sqlite','bhoomidrishti.sqlite-wal','bhoomidrishti.sqlite-shm'].includes(name)) continue;
    const src=path.join(sourceDataDir,name); const dst=path.join(parent,name);
    const st=fs.statSync(src);
    if(st.isDirectory()) fs.cpSync(src,dst,{recursive:true,force:true}); else fs.copyFileSync(src,dst);
  }
  fs.renameSync(tempDb,DB_PATH);
  const manifest={schema:'bhoomidrishti-persistent-store-v1',storageMode:'shared',application:'BHOOMIDHRISHTI',dataRoot:DATA_ROOT_DIR,database:DB_PATH,createdAt:new Date().toISOString(),migratedFrom:chosen.db,sourceProjectCount:chosen.projects,note:'Migrated using SQLite online backup into shared persistent application storage. Source release was not modified and SQLite sidecar files were not copied.'};
  fs.writeFileSync(path.join(parent,'storage-manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  console.log(`Migration complete. Persistent store: ${DATA_ROOT_DIR}`);
  console.log(`Projects available: ${chosen.projects}`);
  console.log('Legacy release remains untouched.');
})().catch(error=>{ console.error(`Persistent-store migration failed: ${error.message}`); process.exit(1); });

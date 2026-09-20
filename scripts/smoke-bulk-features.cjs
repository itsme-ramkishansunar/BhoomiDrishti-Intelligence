'use strict';
const fs=require('node:fs'); const os=require('node:os'); const path=require('node:path'); const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'); const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bhoomidrishti-bulk-features-'));
const env={...process.env,BHOOMI_STORAGE_MODE:'isolated',BHOOMI_ALLOW_CUSTOM_STORAGE:'true',BHOOMI_DATA_DIR:temp,BHOOMI_DB_PATH:path.join(temp,'bhoomidrishti.sqlite')};
function run(script,args=[]){const r=spawnSync(process.execPath,[path.join(root,script),...args],{cwd:root,env,encoding:'utf8'});if(r.status!==0){console.error(r.stdout);console.error(r.stderr);throw new Error(`${script} failed with ${r.status}`);}return r.stdout;}
try{
  run('scripts/setup-local.cjs');
  const out=run('scripts/initialize-bulk-features.cjs');
  const summary=JSON.parse(out);
  if(summary.failed!==0)throw new Error(`expected zero feature initialization failures, got ${summary.failed}`);
  if(summary.featureCount!==15)throw new Error(`expected 15 registered features, got ${summary.featureCount}`);
  const check=run('scripts/verify-persistent-store.cjs');
  console.log('--- feature initialization ---'); console.log(out.trim());
  console.log('--- persistent store ---'); console.log(check.trim());
  console.log('Bulk feature runtime smoke PASSED');
} finally { try{fs.rmSync(temp,{recursive:true,force:true});}catch(_){} }

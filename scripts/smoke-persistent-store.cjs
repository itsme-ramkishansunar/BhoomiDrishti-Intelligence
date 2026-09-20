'use strict';
const assert = (ok,msg)=>{ if(!ok) throw new Error(msg); console.log(`PASS persistence: ${msg}`); };
const path=require('node:path');
const {PROJECT_ROOT, STORAGE_MODE, DEFAULT_PERSISTENT_DATA_ROOT, DATA_ROOT_DIR, DB_PATH, PERSISTENCE_MANIFEST_PATH}=require('../backend/runtime-paths.cjs');
assert(STORAGE_MODE==='shared' || STORAGE_MODE==='isolated','storage mode is normalized');
assert(path.isAbsolute(DATA_ROOT_DIR),'data root is absolute');
assert(path.isAbsolute(DB_PATH),'database path is absolute');
assert(path.isAbsolute(DEFAULT_PERSISTENT_DATA_ROOT),'default persistent root is absolute');
if(STORAGE_MODE==='shared'){
  assert(!DATA_ROOT_DIR.startsWith(PROJECT_ROOT + path.sep),'shared store is outside the release folder');
  assert(DB_PATH===path.join(DATA_ROOT_DIR,'bhoomidrishti.sqlite'),'shared database is anchored to shared data root');
}
assert(PERSISTENCE_MANIFEST_PATH===path.join(DATA_ROOT_DIR,'storage-manifest.json'),'persistence manifest is anchored to data root');
console.log('Persistent-store path contract passed.');

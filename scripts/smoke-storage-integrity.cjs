'use strict';
const path=require('node:path');
const {DATA_ROOT_DIR,DB_PATH,DEFAULT_PERSISTENT_DATA_ROOT}=require('../backend/runtime-paths.cjs');
const releaseRoot=path.resolve(__dirname,'..');
if(String(process.env.BHOOMI_STORAGE_MODE||'shared')==='shared' && path.resolve(DB_PATH).startsWith(releaseRoot+path.sep)) throw new Error('Shared DB resolves inside release folder');
if(path.resolve(DB_PATH)!==path.resolve(path.join(DATA_ROOT_DIR,'bhoomidrishti.sqlite'))) throw new Error('DB is not anchored to persistent data root');
if(!path.isAbsolute(DATA_ROOT_DIR)||!path.isAbsolute(DB_PATH)||!path.isAbsolute(DEFAULT_PERSISTENT_DATA_ROOT)) throw new Error('Persistent paths must be absolute');
console.log('Storage integrity smoke PASSED');

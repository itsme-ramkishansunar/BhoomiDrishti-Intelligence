'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bhoomidrishti-map-runtime-'));
const env={...process.env,BHOOMI_STORAGE_MODE:'shared',BHOOMI_PERSISTENT_ROOT:tmp,BHOOMI_DEMO_ACCESS_ENABLED:'false'};
const script=`
import {upsertProject,getProject,updateProjectLocation,close} from './backend/db.js';
const actor={email:'map-smoke@local',role:'Administrator'};
const p=upsertProject({name:'Map Runtime Smoke',code:'MAP-SMOKE-001',type:'Highway',state:'Tamil Nadu',district:'Salem',status:'ongoing',totalParcels:10,parcelsAcquired:4},actor);
if(!p.latitude||!p.longitude) throw new Error('new project did not receive a defensible map point');
if(p.locationPrecision!=='DISTRICT_CENTROID') throw new Error('new project fallback precision is not DISTRICT_CENTROID');
if(p.locationAuthority!=='DEMO_APPROXIMATE') throw new Error('new project fallback authority is not DEMO_APPROXIMATE');
if(Number(p.locationConfidence)!==0.2) throw new Error('new project fallback confidence is not 0.2');
try { updateProjectLocation(p.id,{latitude:1,longitude:2,locationPrecision:'PROJECT_POINT'},actor); throw new Error('out-of-India coordinates were accepted'); } catch(e) { if(!/India GIS integrity boundary/.test(String(e.message))) throw e; }
try { upsertProject({name:'Bad Coordinates',code:'MAP-SMOKE-BAD',type:'Highway',state:'Tamil Nadu',district:'Salem',latitude:11.6},actor); throw new Error('incomplete coordinates were accepted'); } catch(e) { if(!/Latitude and longitude must be supplied together/.test(String(e.message))) throw e; }
try { upsertProject({name:'Bad Numeric Coordinates',code:'MAP-SMOKE-BAD2',type:'Highway',state:'Tamil Nadu',district:'Salem',latitude:'abc',longitude:'def'},actor); throw new Error('invalid coordinates were accepted'); } catch(e) { if(!/valid numeric coordinates/.test(String(e.message))) throw e; }
console.log('PASS coordinate pair validation');
const exact=updateProjectLocation(p.id,{latitude:11.6643,longitude:78.146,locationPrecision:'PROJECT_POINT',locationSource:'PROJECT_RECORD',locationLabel:'Authorized project coordinate'},actor);
if(exact.locationPrecision!=='PROJECT_POINT' || exact.locationAuthority!=='PROJECT_RECORD_POINT') throw new Error('exact project coordinate update failed');
console.log('PASS new project GIS fallback');
console.log('PASS GIS provenance transition');
console.log('PASS India coordinate rejection');
close();
`;
try {
  const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,env,encoding:'utf8'});
  if(r.status!==0) throw new Error(r.stderr||r.stdout||'map runtime smoke failed');
  process.stdout.write(r.stdout);
  const risk=fs.readFileSync(path.join(root,'src/components/map/RiskMap.jsx'),'utf8');
  for(const token of ['tileFallbackRef','basemaps.cartocdn.com','hadNewData','resolveMissing']) if(!risk.includes(token)) throw new Error(`RiskMap hardening contract missing ${token}`);
  console.log('PASS tile fallback contract');
  console.log('PASS new-project auto-fit contract');
  console.log('MAP RUNTIME HARDENING SMOKE PASSED');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }

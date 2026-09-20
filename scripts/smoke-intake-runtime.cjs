const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const analyzer=path.join(root,'backend','domain','intake-analyzer.js');
const server=fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const page=fs.readFileSync(path.join(root,'src','components','intake','ProjectIntakePage.jsx'),'utf8');
function pass(label,ok){if(!ok)throw new Error(`FAIL intake runtime: ${label}`);console.log(`PASS intake runtime: ${label}`)}
pass('prepare-intelligence endpoint',server.includes("/api/project-intake/:id/prepare-intelligence"));
pass('temporal snapshot endpoint',server.includes("/api/project-intake/:id/temporal-snapshot"));
pass('prepare intelligence UI action',page.includes('prepareIntelligence')&&page.includes('Prepare intelligence'));
pass('as-of selector',page.includes('datetime-local'));
const probe=`import {analyseProjectIntake} from './backend/domain/intake-analyzer.js';\nconst csv='project_name,project_type,state,district,total_land_parcels,parcels_acquired,families_affected,pending_compensation_cases,avg_delay_days,approval_pct,resettlement_pct,project_latitude,project_longitude,status\\nNH-48 Salem Land Acquisition Pilot,Highway,Tamil Nadu,Salem,120,50,48,12,34,68,62,11.6643,78.1460,Ongoing';\nconst a=analyseProjectIntake({documents:[{name:'test.csv',size:csv.length,text:csv,sha256:'x',type:'text/csv',parser:'node:plain-text'}]});\nif(a.projectDraft.name!=='NH-48 Salem Land Acquisition Pilot') process.exit(2);\nif(a.projectDraft.familiesPending!==12||a.projectDraft.approvalPct!==68||a.projectDraft.latitude!==11.6643||a.projectDraft.longitude!==78.146) process.exit(3);\nif(a.missingCritical.length) process.exit(4);\nconsole.log('PASS intake runtime: structured CSV extraction');`;
const r=spawnSync(process.execPath,['--input-type=module','-e',probe],{cwd:root,encoding:'utf8'});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)process.exit(r.status||1);
console.log('PROJECT INTAKE RUNTIME HARDENING SMOKE PASSED');

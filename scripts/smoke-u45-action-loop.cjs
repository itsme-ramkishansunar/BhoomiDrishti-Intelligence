'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const port = 8799;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bhoomidrishti-u45-'));
const dataDir = path.join(tempRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'u45.sqlite');
const email = 'u45-admin@bhoomidrishti.local';
const password = `smoke-${crypto.randomBytes(24).toString('base64url')}`;
const env = { ...process.env, NODE_ENV:'development', BHOOMI_STORAGE_MODE:'isolated', BHOOMI_ALLOW_CUSTOM_STORAGE:'true', BACKEND_PORT:String(port), FRONTEND_ORIGIN:'http://127.0.0.1:5199', BHOOMI_DATA_DIR:dataDir, BHOOMI_DB_PATH:dbPath, BHOOMI_ADMIN_EMAIL:email, BHOOMI_ADMIN_PASSWORD:password, AI_PROVIDER:'local', AI_DATA_MODE:'local_only', BHOOMI_DEMO_ACCESS_ENABLED:'true', SERVE_FRONTEND:'false' };
const child = spawn(process.execPath, ['backend/server.js'], { cwd:ROOT, env, stdio:['ignore','pipe','pipe'] });
child.stdout.on('data', d => process.stdout.write(String(d)));
child.stderr.on('data', d => process.stderr.write(String(d)));
async function wait(url, ms=15000) { const started=Date.now(); let last; while(Date.now()-started<ms){ try { const r=await fetch(url); if(r.ok) return r; } catch(e){last=e;} await new Promise(r=>setTimeout(r,200)); } throw new Error(`Timed out waiting for ${url}: ${last?.message||'unknown'}`); }
function cookieOf(r){ const a=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():[r.headers.get('set-cookie')].filter(Boolean); return a[0].split(';')[0]; }
async function req(pathname,opts={}){ const r=await fetch(`http://127.0.0.1:${port}${pathname}`,opts); const body=await r.json().catch(()=>({})); return {r,body}; }
async function main(){
  await wait(`http://127.0.0.1:${port}/api/health`);
  const login=await req('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(login.r.status!==200) throw new Error(`login failed ${login.r.status}`);
  const cookie=cookieOf(login.r);
  const headers={Cookie:cookie,'Content-Type':'application/json',Accept:'application/json'};
  const pr=await req('/api/projects',{headers});
  if(pr.r.status!==200 || !pr.body.projects?.length) throw new Error('projects unavailable');
  const projectId=pr.body.projects[0].id;
  const fb=await req(`/api/projects/${projectId}/feedback`,{method:'POST',headers,body:JSON.stringify({signalType:'New issue',category:'Documentation',observation:'U45 persistent feedback smoke observation'})});
  if(fb.r.status!==201 || !fb.body.feedback?.id) throw new Error(`feedback create failed ${fb.r.status}`);
  const fbl=await req(`/api/projects/${projectId}/feedback`,{headers});
  if(fbl.r.status!==200 || !fbl.body.feedback?.some(x=>x.id===fb.body.feedback.id)) throw new Error('feedback persistence failed');
  const intv=await req(`/api/projects/${projectId}/interventions`,{method:'POST',headers,body:JSON.stringify({actionText:'U45 smoke action',scenario:{type:'smoke'},estimatedEffect:{note:'non-causal smoke record'}})});
  if(intv.r.status!==201 || !intv.body.action?.id) throw new Error(`intervention create failed ${intv.r.status}`);
  const actionId=intv.body.action.id;
  const upd=await req(`/api/intervention-actions/${actionId}`,{method:'PATCH',headers,body:JSON.stringify({status:'completed',outcome:{result:'smoke-complete'}})});
  if(upd.r.status!==200 || upd.body.action.status!=='completed') throw new Error(`action update failed ${upd.r.status}`);
  const review=await req(`/api/intervention-actions/${actionId}/outcome-review`,{method:'POST',headers,body:JSON.stringify({status:'verified',learningEligible:true,reviewNote:'U45 smoke verified outcome'})});
  if(review.r.status!==200 || review.body.action.outcomeVerificationStatus!=='verified' || !review.body.action.learningEligible) throw new Error(`outcome review failed ${review.r.status}`);
  const actions=await req(`/api/projects/${projectId}/interventions`,{headers});
  if(actions.r.status!==200 || !actions.body.actions.some(x=>x.id===actionId && x.status==='completed')) throw new Error('action persistence failed');
  const p1=await req(`/api/projects/${projectId}/predictive-intelligence`,{headers});
  const p2=await req(`/api/projects/${projectId}/predictive-intelligence`,{headers});
  if(p1.r.status!==200 || p2.r.status!==200) throw new Error('predictive route failed');
  if(!p2.body.persistedDiff?.id) throw new Error('prediction diff was not persisted');
  const trust=await req(`/api/projects/${projectId}/intelligence-trust`,{headers});
  if(trust.r.status!==200 || !trust.body.predictionDiff) throw new Error('trust diff route failed');
  const aiq=await req('/api/ai/chat',{method:'POST',headers,body:JSON.stringify({question:'How many projects are loaded?'})});
  if(aiq.r.status!==200 || !/projects are loaded/i.test(aiq.body.text||'')) throw new Error('AI query intelligence integration failed');
  console.log('U45 ACTION LOOP SMOKE PASSED');
}
main().catch(e=>{console.error(`U45 ACTION LOOP SMOKE FAILED: ${e.stack||e.message}`);process.exitCode=1;}).finally(()=>{setTimeout(()=>{try{child.kill('SIGTERM')}catch{} try{fs.rmSync(tempRoot,{recursive:true,force:true})}catch{}},250);});

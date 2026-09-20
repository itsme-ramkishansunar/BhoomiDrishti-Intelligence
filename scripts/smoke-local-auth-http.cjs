const dotenv=require('dotenv');
const path=require('node:path');
dotenv.config({path:path.join(__dirname,'..','.env'),override:true});
'use strict';
const base=process.env.BHOOMI_TEST_ORIGIN||'http://localhost:8787';
const accounts=[
 ['Administrator',process.env.BHOOMI_ADMIN_EMAIL||'admin@example.invalid',process.env.BHOOMI_ADMIN_PASSWORD||''],
 ['Government Officer',process.env.BHOOMI_GOV_EMAIL||'government.officer@example.invalid',process.env.BHOOMI_GOV_PASSWORD||''],
 ['Department Officer',process.env.BHOOMI_DEPT_EMAIL||'department.officer@example.invalid',process.env.BHOOMI_DEPT_PASSWORD||''],
 ['Legal Officer',process.env.BHOOMI_LEGAL_EMAIL||'legal.officer@example.invalid',process.env.BHOOMI_LEGAL_PASSWORD||''],
 ['Viewer',process.env.BHOOMI_VIEWER_EMAIL||'viewer@example.invalid',process.env.BHOOMI_VIEWER_PASSWORD||''],
];
function cookieOf(r){return r.headers.get('set-cookie')?.split(';')[0]||'';}
async function main(){
 if(!accounts.every(([,email,password])=>email&&password)) throw new Error('Local HTTP auth smoke requires credentials in .env. Run npm run repair:local-access first.');
 const health=await fetch(`${base}/api/health`); if(!health.ok) throw new Error(`Backend health failed: ${health.status}`);
 for(const [role,email,password] of accounts){
  const r=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(`${role} login failed: ${j.error||r.status}`);
  const cookie=cookieOf(r); if(!cookie) throw new Error(`${role} login returned no session cookie`);
  const me=await fetch(`${base}/api/auth/me`,{headers:{cookie}}); const mj=await me.json().catch(()=>({}));
  if(!me.ok||mj.user?.role!==role) throw new Error(`${role} session mismatch`);
  console.log(`PASS HTTP auth: ${role}`);
 }
 console.log('LOCAL AUTH HTTP SMOKE PASSED');
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1);});

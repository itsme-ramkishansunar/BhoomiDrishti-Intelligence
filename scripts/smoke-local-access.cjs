#!/usr/bin/env node
'use strict';
const dotenv=require('dotenv');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
dotenv.config({path:path.join(root,'.env'),override:true});
(async()=>{
  const db=await import('../backend/db.js');
  const accounts=[
    ['Administrator',process.env.BHOOMI_ADMIN_EMAIL||'admin@example.invalid',process.env.BHOOMI_ADMIN_PASSWORD||''],
    ['Government Officer',process.env.BHOOMI_GOV_EMAIL||'government.officer@example.invalid',process.env.BHOOMI_GOV_PASSWORD||''],
    ['Department Officer',process.env.BHOOMI_DEPT_EMAIL||'department.officer@example.invalid',process.env.BHOOMI_DEPT_PASSWORD||''],
    ['Legal Officer',process.env.BHOOMI_LEGAL_EMAIL||'legal@example.invalid',process.env.BHOOMI_LEGAL_PASSWORD||''],
    ['Viewer',process.env.BHOOMI_VIEWER_EMAIL||'viewer@example.invalid',process.env.BHOOMI_VIEWER_PASSWORD||'']
  ];
  if(!process.env.BHOOMI_ADMIN_PASSWORD || !process.env.BHOOMI_GOV_PASSWORD || !process.env.BHOOMI_DEPT_PASSWORD || !process.env.BHOOMI_LEGAL_PASSWORD || !process.env.BHOOMI_VIEWER_PASSWORD) throw new Error('Local access smoke requires credentials in .env. Run npm run repair:local-access first.');
  if(String(process.env.BHOOMI_DEMO_ACCESS_ENABLED||'false').toLowerCase()==='false') throw new Error('Local access smoke requires BHOOMI_DEMO_ACCESS_ENABLED=true.');
  // Re-apply the canonical demo-role contract before verification; repair-local-access has already synchronized the exact env values.
  db.ensureDemoRoleAccounts(true);
  for(const [role,email,password] of accounts){
    const u=db.getUserByEmail(email);
    if(!u||u.status!=='active'||!db.verifyPassword(password,u)) throw new Error(`FAIL local access: ${role}`);
    console.log(`PASS local access: ${role}`);
  }
  console.log('LOCAL ACCESS SMOKE PASSED');
})().catch(e=>{console.error(e?.stack||e);process.exit(1);});

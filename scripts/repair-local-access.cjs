#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const dotenv=require('dotenv');
const ROOT=path.resolve(__dirname,'..');
const ENV_PATH=path.join(ROOT,'.env');
const roles=[
 ['Administrator','BHOOMI_ADMIN_EMAIL','BHOOMI_ADMIN_PASSWORD','admin@example.invalid'],
 ['Government Officer','BHOOMI_GOV_EMAIL','BHOOMI_GOV_PASSWORD','government.officer@example.invalid'],
 ['Department Officer','BHOOMI_DEPT_EMAIL','BHOOMI_DEPT_PASSWORD','department.officer@example.invalid'],
 ['Legal Officer','BHOOMI_LEGAL_EMAIL','BHOOMI_LEGAL_PASSWORD','legal.officer@example.invalid'],
 ['Viewer','BHOOMI_VIEWER_EMAIL','BHOOMI_VIEWER_PASSWORD','viewer@example.invalid']
];
function envQuote(value){return JSON.stringify(String(value));}
function setEnv(text,key,value){const re=new RegExp(`^${key}=.*$`,'m');const line=`${key}=${envQuote(value)}`;return re.test(text)?text.replace(re,line):`${text.trimEnd()}\n${line}\n`;}
function strongLocalPassword(){return `local-${crypto.randomBytes(24).toString('base64url')}`;}
function syncEnv(){
 let text=fs.existsSync(ENV_PATH)?fs.readFileSync(ENV_PATH,'utf8'):'';
 const values={BHOOMI_DEMO_ACCESS_ENABLED:'true',BHOOMI_LOCAL_DEMO_LOCATION_FALLBACK:'true'};
 for(const [,emailKey,passwordKey,emailDefault] of roles){
   values[emailKey]=String(process.env[emailKey]||emailDefault).trim().toLowerCase();
   values[passwordKey]=String(process.env[passwordKey]||'').trim()||strongLocalPassword();
 }
 for(const [k,v] of Object.entries(values)) text=setEnv(text,k,v);
 fs.writeFileSync(ENV_PATH,text,'utf8');
 dotenv.config({path:ENV_PATH,override:true});
}
(async()=>{
 syncEnv();
 const db=await import('../backend/db.js');
 const accounts=roles.map(([role,emailKey,passwordKey])=>[role,process.env[emailKey],process.env[passwordKey]]);
 db.ensureAdmin(accounts[0][1],accounts[0][2]);
 db.ensureDemoRoleAccounts(true);
 for(const [role,email,password] of accounts){
   const u=db.getUserByEmail(email);
   if(!u) throw new Error(`Local account missing after bootstrap: ${role}`);
   const p=db.createPassword(password);
   db.updateLocalPassword(email,p.hash,p.salt);
   const repaired=db.getUserByEmail(email);
   if(!repaired||repaired.status!=='active'||!db.verifyPassword(password,repaired)) throw new Error(`Credential verification failed for ${role}`);
 }
 const locationRepair=db.repairProjectLocationIntegrity();
 console.log('LOCAL ACCESS REPAIR PASSED');
 console.log('Local-only credentials generated/synchronised in .env.');
 for(const [role,email] of accounts) console.log(`${role}: ${email}`);
 console.log(`GIS repair: ${locationRepair.repaired} coordinates classified/recovered, ${locationRepair.cleared} still unresolved.`);
 console.log('Do not copy these credentials into documentation, source control or shared deployment configuration.');
})().catch(err=>{console.error(err?.stack||err);process.exit(1);});

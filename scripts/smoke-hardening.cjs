const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const token of ['IS_PRODUCTION','Production startup requires BHOOMI_ADMIN_EMAIL and BHOOMI_ADMIN_PASSWORD.','replace the development administrator password','BHOOMI_DEMO_ACCESS_ENABLED must be false']) if(!server.includes(token)) throw new Error(`Missing production hardening contract: ${token}`);
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
if(!env.includes('BHOOMI_ADMIN_PASSWORD=')) throw new Error('Admin password env contract missing');
if(!env.includes('BHOOMI_LEGACY_ENV_DISCOVERY=false')) throw new Error('Legacy environment discovery must be disabled by default');
console.log('Production hardening smoke source check passed.');

'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const env=fs.readFileSync(path.join(root,'.env'),'utf8');
const get=k=>{const m=env.match(new RegExp(`^${k}=(.*)$`,'m'));return m?m[1].trim():'';};
const provider=(get('AI_PROVIDER')||'local').toLowerCase();
const mode=(get('AI_DATA_MODE')||'local_only').toLowerCase();
const key=provider==='gemini'?get('GEMINI_API_KEY'):provider==='anthropic'?get('ANTHROPIC_API_KEY'):'local';
if(provider==='local'){console.log('PASS AI provider: local evidence engine');console.log('PASS AI external key: not required in local mode');console.log('AI PROVIDER CONFIG SMOKE PASSED');process.exit(0);}
if(!key){console.log(`INFO AI provider: ${provider}`);console.log('PASS AI safety: external provider selected without key; runtime will safely fall back rather than expose a secret.');console.log('AI PROVIDER CONFIG SMOKE PASSED (provider key not configured)');process.exit(0);}
if(mode!=='external_allowed') throw new Error('External provider key exists but AI_DATA_MODE blocks external use.');
console.log(`PASS AI provider: ${provider}`);console.log('PASS AI key: configured (secret value not displayed)');console.log('PASS AI data mode: external_allowed');console.log('AI PROVIDER CONFIG SMOKE PASSED');
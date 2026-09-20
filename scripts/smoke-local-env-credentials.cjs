#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const env=fs.readFileSync(path.join(root,'.env'),'utf8');
const keys=['BHOOMI_ADMIN_PASSWORD','BHOOMI_GOV_PASSWORD','BHOOMI_DEPT_PASSWORD','BHOOMI_LEGAL_PASSWORD','BHOOMI_VIEWER_PASSWORD'];
for(const key of keys){
  const m=env.match(new RegExp(`^${key}=(.*)$`,'m'));
  if(!m) throw new Error(`Missing ${key} in .env`);
  const raw=m[1].trim();
  if(!/^".*"$/.test(raw) && /#/.test(raw)) throw new Error(`${key} contains '#' and must be quoted in .env`);
}
console.log('LOCAL ENV CREDENTIAL FORMAT PASSED');

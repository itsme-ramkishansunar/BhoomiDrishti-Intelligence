'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const must=[
 ['frontend', 'src/components/ops/DataIntegrationPage.jsx'],
 ['server upload contract','backend/server.js'],
 ['runtime paths','backend/runtime-paths.cjs'],
 ['canonical schema','config/sih26017-canonical-schema.json'],
];
for(const [label,file] of must){if(!fs.existsSync(path.join(root,file)))throw new Error(`${label} missing: ${file}`);}
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
for(const token of ['DataIntegrationPage','data-integration'])if(!app.includes(token))throw new Error(`App integration token missing: ${token}`);
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const token of ['/api/data-ingestion/upload','listDataIngestionRuns'])if(!server.includes(token))throw new Error(`Server ingestion contract missing: ${token}`);
console.log('Data integration center smoke PASSED');

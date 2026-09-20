const fs=require('node:fs'); const path=require('node:path'); const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const required=['smoke:path-contract','smoke:runtime','smoke:source-connectors','smoke:unified-data-backbone','smoke:mapping','smoke:data-ingestion','smoke:portability','smoke:forensics-depth','smoke:intelligence-trust','smoke:hardening','smoke:system-contract','smoke:temporal-reconciliation','smoke:intelligence-preparation','build'];
for(const name of required) if(!pkg.scripts[name]) throw new Error(`Missing required validation script: ${name}`);
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
for(const token of ['SIH26017','Evidence Graph','Temporal','prediction','cross-platform','unified data backbone','precise GIS mapping','mapping-v2-precise']) if(!readme.toLowerCase().includes(token.toLowerCase())) throw new Error(`Master README missing continuity token: ${token}`);
for(const f of ['Dockerfile','docker-compose.yml','manifest.webmanifest','.env.example','docs_DEVELOPMENT_PATHS.md']) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing deployment/config contract: ${f}`);
console.log('System contract smoke passed: core scripts, continuity and deployment artifacts are present.');

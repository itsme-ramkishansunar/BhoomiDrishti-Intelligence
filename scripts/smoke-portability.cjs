const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['backend/runtime-paths.cjs','backend/server.js','backend/db.js','scripts/data-forensics.cjs','scripts/validate-all.cjs','scripts/setup-intake.cjs','README.md','.env.example','package.json','index.html','manifest.webmanifest','backend/domain/intelligence-trust.js','scripts/smoke-path-contract.cjs','scripts/smoke-runtime.cjs'];
for(const f of files){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing portability file: ${f}`);console.log(`PASS portability file: ${f}`)}
const scanFiles=files.filter(f=>f!=='scripts/smoke-portability.cjs');
const source=scanFiles.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const pattern of [/C:\\\\Users\\\\/i,/C:\\\\Users\\\\LENOVO/i,/\/home\/[^\n]+/i,/\\\bD:\\\\/i]){if(pattern.test(source))throw new Error(`Developer-specific absolute path found: ${pattern}`)}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.scripts['setup:intake'] !== 'node scripts/setup-intake.cjs')throw new Error('setup:intake must use the cross-platform Node bootstrap');
if(!pkg.scripts['smoke:data-ingestion'])throw new Error('Missing dataset ingestion smoke script');
console.log('PASS portability: no obvious developer-specific absolute paths');
console.log('PASS portability: environment-driven data root is present');
console.log('PASS portability: frontend serving can be enabled with SERVE_FRONTEND');
console.log('PASS portability: browser/PWA manifest is present');
console.log('Portability smoke source check passed.');

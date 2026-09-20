const fs=require('node:fs');const path=require('node:path');
const root=process.cwd();
const checks=[
 ['U64 version',fs.existsSync(path.join(root,'U64_VERSION.txt'))],
 ['connector check endpoint',fs.readFileSync(path.join(root,'backend/server.js'),'utf8').includes("/api/source-connectors/:id/check")],
 ['connector sync endpoint',fs.readFileSync(path.join(root,'backend/server.js'),'utf8').includes("/api/source-connectors/:id/sync")],
 ['live source test UI',fs.readFileSync(path.join(root,'src/components/ops/IntegrationControlPage.jsx'),'utf8').includes('Test source')],
 ['snapshot capture UI',fs.readFileSync(path.join(root,'src/components/ops/IntegrationControlPage.jsx'),'utf8').includes('Capture snapshot')],
 ['robust response parsing',fs.readFileSync(path.join(root,'src/components/ops/IntegrationControlPage.jsx'),'utf8').includes('readJson')],
 ['no U64 migration',!fs.existsSync(path.join(root,'backend/migrations')) || !fs.readdirSync(path.join(root,'backend/migrations'),{withFileTypes:true}).some(e=>e.name.toLowerCase().includes('u64'))],
];
let failed=0;for(const [name,ok] of checks){if(!ok){console.error(`FAIL U64: ${name}`);failed++;}else console.log(`PASS U64: ${name}`)}
if(failed){process.exit(1)} console.log('U64 connector controls smoke PASSED');

const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('src/App.jsx');
const checks=[
 ['system readiness page',app.includes('ProductionReadinessPage')&&app.includes('id: "readiness"')],
 ['integration control page',app.includes('IntegrationControlPage')&&app.includes('id: "integrations"')],
 ['system readiness API',fs.existsSync(path.join(root,'backend/server.js'))&&read('backend/server.js').includes("/api/system/readiness")],
 ['ML gates API',read('backend/server.js').includes("/api/ml/gates")],
 ['connector catalog API',read('backend/server.js').includes("/api/source-connectors/catalog")],
 ['ingestion runs API',read('backend/server.js').includes("/api/data-ingestion/runs")],
 ['no U62 migration',!fs.existsSync(path.join(root,'database/migrations/018_u62.sql'))],
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} U62: ${n}`);if(!ok)fail++;}
if(fail)process.exit(1);console.log('U62 finalization smoke PASSED');

const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[
 ['U63 version file',read('U63_VERSION.txt').includes('U63_FINAL_UI_PRODUCTION_HARDENING')],
 ['main flex overflow fix',read('src/App.jsx').includes('bd-app-main')],
 ['responsive UI primitives',read('src/index.css').includes('.bd-responsive-kpis')&&read('src/index.css').includes('.bd-app-main { min-width: 0')],
 ['readiness responsive classes',read('src/components/ops/ProductionReadinessPage.jsx').includes('bd-responsive-kpis')&&read('src/components/ops/ProductionReadinessPage.jsx').includes('bd-trust-grid')],
 ['integration sync action',(() => { const ui=read('src/components/ops/IntegrationControlPage.jsx'); return ui.includes('/api/source-connectors/') && ui.includes('sync') && ui.includes("mode==='check'?'check':'sync'"); })()],
 ['integration source link',read('src/components/ops/IntegrationControlPage.jsx').includes('target="_blank"')],
 ['dashboard truthful data label',read('src/components/dashboard/DashboardPage.jsx').includes('Operational data')],
 ['no U63 migration',!fs.existsSync(path.join(root,'database/migrations/063_u63.sql'))],
 ['production boundary preserved',read('src/components/ops/IntegrationControlPage.jsx').includes('does not upgrade a public source into an authoritative') || read('src/components/ops/IntegrationControlPage.jsx').includes('Public-source evidence')],
];
let bad=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} U63: ${name}`);if(!ok)bad++;}
if(bad) process.exit(1); console.log('U63 final UI hardening smoke PASSED');

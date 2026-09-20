const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const db=read('backend/db.js');
const server=read('backend/server.js');
const app=read('src/App.jsx');
const map=read('src/components/map/RiskMap.jsx');
const migration=read('database/migrations/018_project_portfolio_archive.sql');
const checks=[
 ['portfolio archive migration',migration.includes('ALTER TABLE projects ADD COLUMN portfolio_status')&&migration.includes("portfolio_status='archived'")],
 ['known fixture cleanup',migration.toLowerCase().includes('bhoomidrishti_single_project_test')&&migration.toLowerCase().includes('bhoomidrishti_project_import_single_test')],
 ['active project filtering',db.includes("COALESCE(portfolio_status,'active')='active'")],
 ['archive function',db.includes('export function archiveProject')],
 ['restore function',db.includes('export function restoreProject')],
 ['archive API',server.includes("app.delete('/api/projects/:id'")],
 ['restore API',server.includes("app.post('/api/projects/:id/restore'")],
 ['admin permission gate',server.includes("requirePermission('projects:archive')")],
 ['projects remove control',app.includes('onArchiveProject')&&app.includes('Remove</button>')],
 ['map remove control',map.includes('Remove project')&&map.includes('onArchiveProject')],
];
let failed=0;for(const [label,ok] of checks){if(ok)console.log(`PASS ${label}`);else{console.error(`FAIL ${label}`);failed++;}}
if(failed)process.exit(1);console.log('PROJECT PORTFOLIO HYGIENE SMOKE PASSED');

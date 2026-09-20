#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const checks=[];
function ok(name,condition){checks.push({name,ok:Boolean(condition)});if(!condition)console.error(`FAIL ${name}`);else console.log(`PASS ${name}`);}
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const pkg=JSON.parse(read('package.json'));
ok('release version',['1.0.30-u75.10-bulk-closure','1.0.32-u75.10-final-deployment'].includes(pkg.version),'1.0.32-u75.10-final-deployment');
ok('closure domain exists',fs.existsSync(path.join(root,'backend/domain/u75.10-bulk-closure.js')));
const closure=read('backend/domain/u75.10-bulk-closure.js');
ok('reconciliation contract',closure.includes('buildBulkReconciliation'));
ok('closure health contract',closure.includes('buildBulkClosureHealth'));
ok('safe-to-proceed guard',closure.includes("safeToProceed"));
const server=read('backend/server.js');
ok('closure health API',server.includes("/api/admin/u75/bulk/health"));
ok('reconciliation API',server.includes("/api/admin/u75/bulk/reconciliation"));
ok('preflight API',server.includes("/api/admin/u75/bulk/preflight"));
ok('safe promotion propagation',server.includes("const propagation=promotedIds.length?propagateBulkProjectsForAdmin"));
ok('closure module import',server.includes("u75.10-bulk-closure.js"));
const ui=read('src/components/ops/DataIntegrationPage.jsx');
ok('bulk health UI',ui.includes("Bulk health"));
ok('bulk preflight UI',ui.includes("Preflight"));
ok('bulk reconcile UI',ui.includes("Reconcile"));
ok('closure health state',ui.includes("closureHealth"));
ok('reconciliation state',ui.includes("reconciliation"));
ok('no destructive DB command in closure module',!/\b(DROP TABLE|DELETE FROM|TRUNCATE)\b/i.test(closure));
ok('release includes closure smoke',pkg.scripts["release:production"].includes("smoke:u75.10-bulk-closure"));

const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({ok:failed.length===0,version:pkg.version,checks:checks.length,failed:failed.map(x=>x.name)},null,2));
process.exit(failed.length?1:0);

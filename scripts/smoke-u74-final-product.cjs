#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const pkg=JSON.parse(fs.readFileSync(path.join(process.cwd(),'package.json'),'utf8'));
const server=fs.readFileSync(path.join(process.cwd(),'backend/server.js'),'utf8');
const app=fs.readFileSync(path.join(process.cwd(),'src/App.jsx'),'utf8');
const checks=[];
function pass(name,ok,detail=''){checks.push({name,ok,detail}); if(!ok) throw new Error(`${name}: ${detail||'failed'}`); console.log(`PASS ${name}${detail?` — ${detail}`:''}`);}
pass('release version',pkg.version==='1.0.19-u74-final-product' || /^1\.0\.(20-u75-bulk-integration|21-u75\.1-full-integration|22-u75\.2-action-intelligence|24-u75\.2-4-bulk-intelligence|25-u75\.5-evidence-promotion|26-u75\.6-interactive-command-center|27-u75\.7-bulk-reliability|28-u75\.8-governed-bulk-workbench|29-u75\.9-bulk-intelligence-propagation|30-u75\.10-bulk-closure|32-u75\.10-final-deployment)$/.test(pkg.version),pkg.version);
pass('evidence export route',server.includes("/api/projects/:id/evidence-pack"));
pass('evidence export RBAC',server.includes("requirePermission('reports:read')"));
pass('evidence export scope guard',server.includes("isProjectAuthorised(req.user,project)"));
pass('evidence export governance boundary',server.includes('productionProbabilityAllowed:false'));
pass('evidence export audit',server.includes("report.evidence_pack.exported"));
pass('frontend evidence button',app.includes('Evidence pack'));
pass('frontend evidence download',app.includes('/evidence-pack'));
pass('frontend export error handling',app.includes('Evidence pack export failed.'));
for(const rel of ['backend/domain/language-integrity.js','scripts/smoke-u73-language-integrity.mjs','scripts/smoke-u72.4.2-functional.mjs','scripts/smoke-project-portfolio-hygiene.cjs','src/components/ops/ProductionReadinessPage.jsx']) pass(`release artifact ${rel}`,fs.existsSync(path.join(process.cwd(),rel)));
for(const key of ['smoke:u74-final-product','release:production','smoke:u73-language-integrity','smoke:u72.4.2-functional','build']) pass(`npm script ${key}`,Boolean(pkg.scripts?.[key]));
console.log(JSON.stringify({ok:true,version:pkg.version,checks:checks.length,failed:checks.filter(x=>!x.ok)}));

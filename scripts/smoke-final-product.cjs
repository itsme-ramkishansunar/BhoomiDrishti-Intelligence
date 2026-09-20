#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const ROOT = process.cwd();
const requiredFiles = [
  'package.json', 'backend/server.js', 'backend/db.js',
  'src/App.jsx', 'src/components/ops/OperationsCenterPage.jsx',
  'src/components/ai/BhoomiAIPage.jsx', 'backend/domain/unified-data-backbone.js', 'database/migrations/014_unified_data_backbone.sql', 'scripts/start-local-all.cjs',
  'scripts/smoke-operational-intelligence.cjs', 'scripts/smoke-mlops.cjs', 'scripts/smoke-replay.cjs',
  'scripts/migrate-persistent-store.cjs', 'scripts/verify-persistent-store.cjs', 'scripts/smoke-persistent-store.cjs','scripts/smoke-validation-isolation.cjs','backend/domain/bulk-initialization.js','INSTALL_U55_WINDOWS.ps1','scripts/initialize-all-projects.cjs','scripts/smoke-bulk-initialize.cjs'
];
for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error(`Missing final-product artifact: ${rel}`);
  console.log(`PASS final-product artifact: ${rel}`);
}
const app = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
for (const token of ['/api/alerts?status=all&limit=300', '/api/alerts/generate', '/api/alerts/', 'Early-warning alerts', 'Operations Center']) {
  if (!app.includes(token)) throw new Error(`Missing final product contract: ${token}`);
  console.log(`PASS final-product contract: ${token}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (const key of ['start:all', 'release:check', 'initialize:all', 'smoke:bulk-initialize']) {
  if (!pkg.scripts || !pkg.scripts[key]) throw new Error(`Missing npm script: ${key}`);
  console.log(`PASS final-product npm script: ${key}`);
}
console.log('Final product smoke source/schema check PASSED');

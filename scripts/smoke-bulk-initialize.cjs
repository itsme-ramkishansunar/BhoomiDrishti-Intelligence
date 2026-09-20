#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'backend/domain/bulk-initialization.js',
  'scripts/initialize-all-projects.cjs',
  'src/components/ops/DataHealthPage.jsx',
  'backend/server.js',
  'INSTALL_U55_WINDOWS.ps1',
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing bulk-initialization artifact: ${rel}`);
  console.log(`PASS bulk-initialize artifact: ${rel}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const key of ['initialize:all','smoke:bulk-initialize']) {
  if (!pkg.scripts?.[key]) throw new Error(`Missing npm script: ${key}`);
  console.log(`PASS bulk-initialize npm script: ${key}`);
}
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
for (const token of ["/api/admin/bulk-initialize", "getBulkInitializationStatus", "bulkInitializeProjects"]) {
  if (!server.includes(token)) throw new Error(`Missing bulk-initialize server contract: ${token}`);
  console.log(`PASS bulk-initialize server contract: ${token}`);
}
const ui = fs.readFileSync(path.join(root, 'src/components/ops/DataHealthPage.jsx'), 'utf8');
for (const token of ['Bulk initialize', '/api/admin/bulk-initialize', 'fullyInitialized']) {
  if (!ui.includes(token)) throw new Error(`Missing bulk-initialize UI contract: ${token}`);
  console.log(`PASS bulk-initialize UI contract: ${token}`);
}
console.log('Bulk initialization source contract PASSED');

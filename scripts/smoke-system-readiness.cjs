const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
for (const token of ["app.get('/api/system/readiness'", 'system-readiness-v1', 'productionModelPromotable', 'automaticProjectBootstrap', 'Government integrations remain adapter/configuration dependent']) {
  if (!server.includes(token)) throw new Error(`Missing system readiness contract: ${token}`);
  console.log(`PASS system-readiness contract: ${token}`);
}
console.log('System readiness smoke PASSED');

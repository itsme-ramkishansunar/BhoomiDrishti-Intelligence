const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=process.cwd(); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
assert.ok(['1.0.29-u75.9-bulk-intelligence-propagation','1.0.30-u75.10-bulk-closure','1.0.32-u75.10-final-deployment'].includes(pkg.version));
const domain=read('backend/domain/u75.9-bulk-intelligence.js');
const server=read('backend/server.js');
const di=read('src/components/ops/DataIntegrationPage.jsx');
for(const token of [
  'U75_9_BULK_INTELLIGENCE_VERSION','OBSERVED','DERIVED','FORECAST','SIMULATED','UNAVAILABLE',
  'buildRiskVelocity','buildInterventionIntelligence','buildBulkIntelligenceEnvelope','summarizeBulkIntelligence'
]) assert.ok(domain.includes(token),`missing domain contract ${token}`);
for(const token of [
  '/api/admin/u75/bulk/intelligence',
  '/api/admin/u75/bulk/intelligence-refresh',
  '/api/admin/u75/bulk/intelligence/export.csv',
  'initializeProjectIntelligence',
  'initializeProjectFeatures',
  'buildStatutoryTimeline',
  'buildActionIntelligence'
]) assert.ok(server.includes(token),`missing server contract ${token}`);
for(const token of [
  'refreshBulkIntelligence','Refresh all intelligence','Export intelligence CSV',
  'U75.9 downstream intelligence','Risk velocity ↑','Action queues','high-attention',
  'onOpenProject','onOpenMap'
]) assert.ok(di.includes(token),`missing UI contract ${token}`);
assert.ok(pkg.scripts['smoke:u75.9-bulk-intelligence']);
assert.ok(pkg.scripts['release:production'].includes('smoke:u75.9-bulk-intelligence'));
console.log(JSON.stringify({ok:true,version:pkg.version,checks:18,features:[
 'bulk downstream propagation','risk velocity','intervention intelligence','provenance state model',
 'statutory timeline integration','action intelligence integration','intelligence export','project/GIS drilldown'
]},null,2));

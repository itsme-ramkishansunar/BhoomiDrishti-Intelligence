const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=process.cwd(); const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json')); const db=read('backend/db.js'); const server=read('backend/server.js'); const di=read('src/components/ops/DataIntegrationPage.jsx'); const app=read('src/App.jsx');
assert.ok(['1.0.28-u75.8-governed-bulk-workbench','1.0.29-u75.9-bulk-intelligence-propagation','1.0.30-u75.10-bulk-closure','1.0.32-u75.10-final-deployment'].includes(pkg.version));
assert.match(db,/listBulkPromotionBatches/); assert.match(server,/\/api\/admin\/u75\/bulk\/batches/); assert.match(server,/review-decision/);
for(const token of ['Resume latest batch','Select all safe','Clear selection','Export evidence','Review decision','Open project','Open GIS','Sync all']) assert.match(di,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(di,/onOpenProject/); assert.match(app,/DataIntegrationPage canAdmin/);
console.log(JSON.stringify({ok:true,version:pkg.version,checks:12},null,2));

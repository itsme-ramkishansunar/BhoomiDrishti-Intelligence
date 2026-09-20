const fs=require('node:fs'); const path=require('node:path'); const root=path.resolve(__dirname,'..');
const resolver=fs.readFileSync(path.join(root,'backend','domain','entity-resolution.js'),'utf8'); const analyzer=fs.readFileSync(path.join(root,'backend','domain','intake-analyzer.js'),'utf8');
for(const t of ['resolveEntities','deterministic-normalization-and-evidence-linking','humanReviewBelow','SUPPORTED_BY_FIELD','HAS_MILESTONE','HAS_IDENTIFIER']){if(!resolver.includes(t))throw new Error(`Missing entity-resolution contract: ${t}`);console.log(`PASS entity-resolution contract: ${t}`)}
for(const t of ['entityResolution','evidenceGraph']){if(!analyzer.includes(t))throw new Error(`Missing intake graph contract: ${t}`);console.log(`PASS intake graph contract: ${t}`)}
console.log('Entity resolution smoke source check passed.');

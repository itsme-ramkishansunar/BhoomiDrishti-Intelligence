const fs=require('node:fs'); const path=require('node:path');
const root=path.join(__dirname,'..');
const required=['backend/domain/source-connectors.js','database/migrations/009_source_connector_snapshots.sql','backend/server.js','backend/db.js','src/components/ops/DataHealthPage.jsx','README.md'];
for(const f of required){if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing source connector file: ${f}`); console.log(`PASS source connector file: ${f}`);}
const domain=fs.readFileSync(path.join(root,'backend/domain/source-connectors.js'),'utf8');
for(const needle of ['PUBLIC_CONNECTOR_CATALOG','fetchPublicConnector','bodySha256','Public-source snapshot only']) { if(!domain.includes(needle)) throw new Error(`Missing source connector contract: ${needle}`); console.log(`PASS source connector contract: ${needle}`); }
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const needle of ["/api/source-connectors/catalog","/api/source-connectors/:id/sync","createSourceConnectorSnapshot","createSourceConnectorFailure"]) { if(!server.includes(needle)) throw new Error(`Missing source connector route contract: ${needle}`); console.log(`PASS source connector route: ${needle}`); }
const db=fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
for(const needle of ['MIGRATION_9','source_connector_snapshots','listSourceConnectorSnapshots']) { if(!db.includes(needle)) throw new Error(`Missing source connector DB contract: ${needle}`); console.log(`PASS source connector DB: ${needle}`); }
console.log('Source connectors smoke source/schema check passed.');

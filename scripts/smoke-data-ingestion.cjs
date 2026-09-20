const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const db=fs.readFileSync(path.join(root,'backend','db.js'),'utf8');
const mig=fs.readFileSync(path.join(root,'database','migrations','010_data_ingestion_runs.sql'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const checks=[
 ['migration','010_data_ingestion_runs.sql',fs.existsSync(path.join(root,'database','migrations','010_data_ingestion_runs.sql'))],
 ['db create','createDataIngestionRun',db.includes('createDataIngestionRun')],
 ['db update','updateDataIngestionRun',db.includes('updateDataIngestionRun')],
 ['upload route','/api/data-ingestion/upload',server.includes('/api/data-ingestion/upload')],
 ['list route','/api/data-ingestion/runs',server.includes('/api/data-ingestion/runs')],
 ['supported csv', '.csv',server.includes("'.csv','.tsv','.json','.ndjson','.xlsx'")],
 ['100MB guard','100*1024*1024',server.includes('100*1024*1024')],
 ['no model promotion','No model was trained or promoted',server.includes('No model was trained or promoted')],
 ['unverified label','USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',server.includes('USER_UPLOADED / NOT_GOVERNMENT_VERIFIED')&&readme.includes('USER_UPLOADED / NOT_GOVERNMENT_VERIFIED')],
 ['migration table','data_ingestion_runs',mig.includes('CREATE TABLE IF NOT EXISTS data_ingestion_runs')],
];
for(const [label,needle,ok] of checks){if(!ok)throw new Error(`FAIL ${label}: ${needle}`);console.log(`PASS data-ingestion contract: ${label}`)}
console.log('Dataset ingestion smoke source/schema check passed.');

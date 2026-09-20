const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const analyzer=fs.readFileSync(path.join(root,'backend','domain','intake-analyzer.js'),'utf8');
const page=fs.readFileSync(path.join(root,'src','components','intake','ProjectIntakePage.jsx'),'utf8');
const db=fs.readFileSync(path.join(root,'backend','db.js'),'utf8');
for(const t of ["/api/project-intake/extract","/api/project-intake/analyze","/api/project-intake/:id/create-project","/api/project-intake/:id/reconcile","/api/project-intake/:id/canonical","readMultipartFile","extractUploadedFile"]){if(!server.includes(t))throw new Error(`Missing project-intake server contract: ${t}`);console.log(`PASS server contract: ${t}`)}
for(const t of ['analyseProjectIntake','projectDraft','candidateSignal','missingCritical','sourceClassification','combinedTextSha256','fieldEvidence','conflicts','milestoneTimeline','acquisitionReadiness','evidenceGraph','entityResolution']){if(!analyzer.includes(t))throw new Error(`Missing intake-analyzer contract: ${t}`);console.log(`PASS analyzer contract: ${t}`)}
for(const t of ['New Project Intelligence Intake','Analyze pack','Create project draft','without requiring ChatGPT']){if(!page.includes(t))throw new Error(`Missing intake UI contract: ${t}`);console.log(`PASS UI contract: ${t}`)}
for(const t of ['project_intakes','project_intake_files','createProjectIntake','getProjectIntake','attachProjectToIntake']){if(!db.includes(t))throw new Error(`Missing intake DB contract: ${t}`);console.log(`PASS DB contract: ${t}`)}
for(const f of ['backend/domain/intake-analyzer.js','backend/domain/entity-resolution.js','scripts/extract-document.py','database/migrations/006_project_intake.sql','src/components/intake/ProjectIntakePage.jsx','requirements-intake.txt']){if(!fs.existsSync(path.join(root,f)))throw new Error(`Missing intake file: ${f}`);console.log(`PASS file: ${f}`)}
console.log('Project intake smoke source check passed.');

const multipart=server.slice(server.indexOf('async function readMultipartFile'),server.indexOf('function extractUploadedFile'));
for(const t of ['boundaryMatch','content-disposition\\s*:\\s*form-data','filename','No file field was supplied']){if(!multipart.includes(t))throw new Error(`Missing multipart hardening contract: ${t}`);console.log(`PASS multipart contract: ${t}`)}
const app=fs.readFileSync(path.join(root,'src','App.jsx'),'utf8');
for(const t of ['IMPORT_ALIASES','project_name','project_code','total_land_parcels','pending_compensation_cases','project_latitude','project_longitude','India GIS integrity boundary']){if(!app.includes(t))throw new Error(`Missing project import hardening contract: ${t}`);console.log(`PASS import contract: ${t}`)}
console.log('Project intake/import hardening smoke source check passed.');

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'config', 'sih26017-canonical-schema.json'), 'utf8'));
const INPUT_DEFAULT = process.env.BHOOMI_FORENSICS_INPUT || path.join(root, 'backend', 'data', 'incoming');
const OUTPUT_DEFAULT = process.env.BHOOMI_FORENSICS_OUTPUT || path.join(root, 'backend', 'data', 'forensics');

function arg(name) {
  const p = `--${name}=`;
  const hit = process.argv.slice(2).find(v => v.startsWith(p));
  return hit ? hit.slice(p.length) : null;
}
function abs(p) { return path.resolve(root, p || '.'); }
function loadMapping(mappingPath) {
  if (!mappingPath) return null;
  const full = abs(mappingPath);
  if (!fs.existsSync(full)) throw new Error(`Mapping file not found: ${mappingPath}`);
  const value = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!value || typeof value !== 'object' || typeof value.fields !== 'object') throw new Error('Mapping file must contain an object property: fields');
  return value;
}
function validateMapping(mapping, reports) {
  if (!mapping) return {status:'NOT_PROVIDED',errors:[],fields:{}};
  const available = new Set(reports.flatMap(f => (f.sheets||[]).flatMap(s => s.headers||[])));
  const reverse = new Map(); const errors=[];
  for (const [canonical, sourceField] of Object.entries(mapping.fields)) {
    const source = typeof sourceField === 'string' ? sourceField : sourceField?.sourceField;
    if (!source) { errors.push({canonical,error:'SOURCE_FIELD_MISSING'}); continue; }
    if (!available.has(source)) errors.push({canonical,sourceField:source,error:'SOURCE_FIELD_NOT_FOUND'});
    const prev = reverse.get(source); if (prev) errors.push({canonical,sourceField:source,error:'SOURCE_FIELD_MAPPED_MULTIPLE_TIMES',previousCanonical:prev}); else reverse.set(source,canonical);
  }
  if (mapping.target && typeof mapping.target === 'object') {
    for (const k of ['definition','sourceFields']) if (!(k in mapping.target)) errors.push({targetError:`TARGET_${k.toUpperCase()}_MISSING`});
  }
  return {status:errors.length?'INVALID':'VALID_FOR_REVIEW',errors,fields:mapping.fields,target:mapping.target||null};
}
function makeDictionary(reports) {
  const out={};
  for (const f of reports) for (const s of (f.sheets||[])) for (const h of s.headers) {
    const c=s.columns[h]; out[`${f.relativePath}#${s.sheet||'default'}:${h}`]={file:f.relativePath,sheet:s.sheet||null,sourceField:h,type:c.type,missingPct:c.missingPct,uniquePct:c.uniquePct,suggestions:c.suggestions,dateRange:c.dateRange};
  }
  return out;
}
function splitPlan(reports) {
  const rows = reports.reduce((a,f)=>a+f.sheets.reduce((b,s)=>b+s.rows,0),0);
  return {mode:'project_cohort_temporal',note:'Planned split only. Final cohort date field and boundaries require source validation.',recommended:{train:'earliest ~70%',validation:'next ~15%',test:'latest ~15%'},rowsObserved:rows,projectLevelSplitRequired:true,randomSplitRecommended:false,pointInTimeFeaturesRequired:true,rightCensoringRequired:true};
}
function outcomeReview(reports) {
  const candidates=[]; for(const f of reports) for(const s of f.sheets||[]) for(const c of s.labels.candidateFields||[]) candidates.push({...c,file:f.relativePath,sheet:s.sheet||null});
  const unique=[...new Map(candidates.map(x=>[`${x.file}|${x.sheet}|${x.field}|${x.canonical}`,x])).values()];
  return {status:'REQUIRES_SOURCE_REVIEW',candidates:unique,allowedOutcomeFamilies:['stage_deadline_breach','additional_delay_days','time_to_event','milestone_miss'],forbiddenShortcut:'Do not infer a negative label from an ongoing project whose future outcome is unknown.'};
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function listFiles(input) {
  if (fs.existsSync(input) && fs.statSync(input).isFile()) return [input];
  if (!fs.existsSync(input)) return [];
  const out = []; const stack = [input];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(f);
      else if (/\.(csv|tsv|json|ndjson|xlsx)$/i.test(e.name)) out.push(f);
    }
  }
  return out.sort();
}
function parseDelimited(text, delim) {
  const lines = text.split(/\r?\n/).filter(x => x.trim());
  if (!lines.length) return {headers:[], rows:[]};
  const split = (line) => { const cells=[]; let cur='', q=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(q && line[i+1]==='"'){cur+='"'; i++;} else q=!q; } else if(c===delim && !q){cells.push(cur);cur='';} else cur+=c; } cells.push(cur); return cells.map(v=>v.trim()); };
  const headers = split(lines[0]).map((h,i)=>h || `column_${i+1}`);
  const rows = lines.slice(1).map(line=>{ const vals=split(line); const row={}; headers.forEach((h,i)=>row[h]=vals[i] ?? ''); return row; });
  return {headers,rows};
}
function inspectXlsx(file) {
  const pyCandidates = process.platform === 'win32' ? ['py','python','python3'] : ['python3','python'];
  let last = '';
  for (const exe of pyCandidates) {
    const r = cp.spawnSync(exe, ['scripts/xlsx-inspect.py', file], {cwd: root, encoding:'utf8', stdio:['ignore','pipe','pipe'], windowsHide:true, timeout:120000});
    if (r.status === 0 && r.stdout) return JSON.parse(r.stdout);
    last = (r.stderr || r.stdout || '').trim();
  }
  throw new Error(`XLSX inspection failed: ${last || 'Python 3 not available'}`);
}
function parseFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.xlsx') return inspectXlsx(file);
  const raw = fs.readFileSync(file, 'utf8');
  if (ext === '.json') { const x=JSON.parse(raw); const rows=Array.isArray(x)?x:(Array.isArray(x?.data)?x.data:[x]); return [{sheet:null,headers:[...new Set(rows.flatMap(r=>Object.keys(r||{})))],rows}]; }
  if (ext === '.ndjson') { const rows=raw.split(/\r?\n/).filter(Boolean).map(JSON.parse); return [{sheet:null,headers:[...new Set(rows.flatMap(r=>Object.keys(r||{})))],rows}]; }
  const parsed=parseDelimited(raw, ext === '.tsv' ? '\t' : ',');
  return [{sheet:null,...parsed}];
}
function normalized(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function inferType(values){
  const v=values.filter(x=>x!==null&&x!==undefined&&String(x).trim()!=='').map(String); if(!v.length)return 'empty';
  const numeric=v.filter(x=>Number.isFinite(Number(x))).length/v.length; if(numeric>=0.95)return 'numeric';
  const bool=v.filter(x=>/^(true|false|yes|no|0|1)$/i.test(x)).length/v.length; if(bool>=0.95)return 'boolean_or_numeric';
  const dates=v.filter(x=>Number.isFinite(Date.parse(x))).length/v.length; if(dates>=0.95)return 'date_or_datetime';
  return 'text_or_categorical';
}
function fieldSuggestion(header){
  const h=normalized(header); const hits=[];
  for(const [canonical,meta] of Object.entries(schema.fields)){
    const aliases=meta.aliases.map(normalized);
    let score=0;
    if(aliases.includes(h)) score=1;
    else if(aliases.some(a=>h.includes(a)||a.includes(h))) score=0.72;
    if(score) hits.push({canonical,score,role:meta.role});
  }
  return hits.sort((a,b)=>b.score-a.score).slice(0,3);
}
function profileColumn(rows,h){
  const vals=rows.map(r=>r?.[h]); const non=vals.filter(v=>v!==null&&v!==undefined&&String(v).trim()!==''); const unique=new Set(non.map(String)).size;
  const type=inferType(vals); const suggestions=fieldSuggestion(h); const parsedDates=type==='date_or_datetime'?non.map(x=>Date.parse(x)).filter(Number.isFinite):[];
  return {type,rowCount:rows.length,nonEmptyCount:non.length,missingCount:rows.length-non.length,missingPct:rows.length?Number(((rows.length-non.length)/rows.length*100).toFixed(2)):0,uniqueCount:unique,uniquePct:rows.length?Number((unique/rows.length*100).toFixed(2)):0,suggestions,dateRange:parsedDates.length?{min:new Date(Math.min(...parsedDates)).toISOString(),max:new Date(Math.max(...parsedDates)).toISOString()}:null};
}
function grainAssessment(headers,columns,rows){
  const candidates=[];
  for(const h of headers){
    const s=columns[h];
    const strong=s.suggestions.find(x=>x.score===1 && ['identifier','identity'].includes(schema.fields[x.canonical]?.role));
    if(strong) candidates.push({field:h,canonical:strong.canonical,uniquePct:s.uniquePct,repeatLikely:s.uniquePct<99});
  }
  const project = candidates.find(x=>x.canonical==='project_id') || candidates.find(x=>/project/i.test(x.field));
  return {identifierCandidates:candidates.slice(0,15),primaryProjectIdCandidate:project||null,observationLikely:project?project.uniquePct<99:null,grainConfidence:project?(project.uniquePct>=95?'high':'medium'):'unknown'};
}
function labelAssessment(columns){
  const candidates=[];
  for(const [field,c] of Object.entries(columns)) for(const s of c.suggestions){ if(['outcome_candidate','outcome_temporal','label_support'].includes(s.role)) candidates.push({field,canonical:s.canonical,score:s.score,completenessPct:Number((100-c.missingPct).toFixed(2)),type:c.type}); }
  return {candidateFields:[...new Map(candidates.map(x=>[`${x.field}|${x.canonical}`,x])).values()].sort((a,b)=>b.score-a.score),rule:'Candidate only. Final target requires source-document confirmation and a defensible prediction cutoff.'};
}
function mapReadiness(fileReports){
  const all = fileReports.flatMap(f=>f.sheets||[]);
  const project = all.find(s=>s.grain?.primaryProjectIdCandidate);
  const anyDate = all.some(s=>Object.values(s.columns||{}).some(c=>c.type==='date_or_datetime'));
  const anyOutcome = all.some(s=>(s.labels?.candidateFields||[]).length);
  const blockers=[];
  if(!project) blockers.push('PROJECT_IDENTIFIER_NOT_CONFIRMED');
  if(!anyDate) blockers.push('NO_DATE_FIELD_CANDIDATE');
  if(!anyOutcome) blockers.push('NO_OUTCOME_FIELD_CANDIDATE');
  blockers.push('FINAL_LABEL_REQUIRES_SOURCE_VALIDATION');
  return {status:blockers.length===1?'READY_FOR_SCHEMA_REVIEW':'SCHEMA_REVIEW_REQUIRED',blockers,modelPromotionAllowed:false,trainingAllowed:false,reason:'U46 only establishes data readiness; it does not train or promote a model.'};
}
function markdown(report){
  const lines=[]; lines.push(`# SIH26017 Data Pipeline Report`, '', `Generated: ${report.generatedAt}`, `Schema: ${report.schemaVersion}`, `Input: ${report.inputPath}`, '', `## Readiness`, `- Dataset version: **${report.datasetVersion}**`, `- Status: **${report.readiness.status}**`, `- Training allowed: **${report.readiness.trainingAllowed}**`, `- Model promotion allowed: **${report.readiness.modelPromotionAllowed}**`, `- Blockers: ${report.readiness.blockers.join(', ') || 'none'}`, '', `## Files`);
  for(const f of report.files){ lines.push(`### ${f.relativePath}`, `- SHA-256: ${f.sha256}`, `- Bytes: ${f.bytes}`, `- Classification: ${f.sourceClassification}`); for(const s of (f.sheets||[])){lines.push(`- Sheet: ${s.sheet||'default'}; rows=${s.rows}; columns=${s.headers.length}; grain=${s.grain.grainConfidence}`, `- Project ID candidate: ${s.grain.primaryProjectIdCandidate?.field||'not confirmed'}`, `- Outcome candidates: ${(s.labels.candidateFields||[]).map(x=>`${x.field}→${x.canonical}`).slice(0,8).join(', ')||'none'}`);}}
  lines.push('', '## Non-negotiable controls', '- User/authorized source data remains separate from synthetic/demo data.', '- Final target, label threshold, prediction cutoff and model family are not locked by heuristics.', '- Ongoing/future-unknown cases are not converted into negative labels.', '- Prediction features must respect information availability at prediction time.', '- No model is trained or promoted by this script.'); return lines.join('\n');
}
function runPipeline({input=null,output=null,mapping=null}={}){
  const inputPath=abs(input||INPUT_DEFAULT); const outputPath=abs(output||OUTPUT_DEFAULT); const files=listFiles(inputPath);
  const mappingConfig=loadMapping(mapping || arg('mapping'));
  if(!files.length) throw new Error(`No supported dataset files found at ${path.relative(root,inputPath)||'.'}. Place authorized files in backend/data/incoming or set BHOOMI_FORENSICS_INPUT.`);
  const reports=[];
  for(const file of files){
    const parsed=parseFile(file); const sheets=[];
    for(const sh of parsed){
      const headers=sh.headers||[]; const rows=sh.rows||[]; const columns={}; for(const h of headers) columns[h]=profileColumn(rows,h);
      const dupMap=new Map(); for(const row of rows){const h=crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex');dupMap.set(h,(dupMap.get(h)||0)+1);} const duplicateRows=[...dupMap.values()].filter(n=>n>1).reduce((a,n)=>a+n,0);
      sheets.push({sheet:sh.sheet||null,rows:rows.length,headers,columns,grain:grainAssessment(headers,columns,rows),labels:labelAssessment(columns),duplicateRowCount:duplicateRows});
    }
    reports.push({relativePath:path.relative(root,file),sha256:sha256(file),bytes:fs.statSync(file).size,format:path.extname(file).slice(1).toLowerCase(),sourceClassification:'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',sheets});
  }
  const mappingReview=validateMapping(mappingConfig,reports);
  const dictionary=makeDictionary(reports);
  const outcome=outcomeReview(reports);
  const split=splitPlan(reports);
  const manifestMaterial=reports.map(f=>`${f.relativePath}:${f.sha256}`).sort().join('\n');
  const datasetVersion=`DSV-${crypto.createHash('sha256').update(`${schema.schemaVersion}\n${manifestMaterial}`).digest('hex').slice(0,16).toUpperCase()}`;
  const readiness=mapReadiness(reports);
  if(mappingConfig && mappingReview.errors.length) readiness.blockers.push('MAPPING_VALIDATION_ERRORS');
  const report={schemaVersion:'sih26017-data-pipeline-v1',datasetVersion,generatedAt:new Date().toISOString(),inputPath:path.relative(root,inputPath),files:reports,canonicalSchema:schema.schemaVersion,mapping:mappingReview,readiness,outcomeReview:outcome,splitPlan:split,controls:{noModelTraining:true,noModelPromotion:true,finalLabelHumanValidated:false,temporalEvaluationRequired:true,rightCensoringRequiredWhenFutureUnknown:true,provenanceRequiredForPromotion:true,syntheticGroundTruthForbidden:true}};
  fs.mkdirSync(outputPath,{recursive:true}); const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const jsonPath=path.join(outputPath,`sih26017-pipeline-${stamp}.json`); const mdPath=path.join(outputPath,`sih26017-pipeline-${stamp}.md`); fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)); fs.writeFileSync(mdPath,markdown(report));
  fs.writeFileSync(path.join(outputPath,'SIH26017_DATA_READINESS_LATEST.json'),JSON.stringify(report,null,2)); fs.writeFileSync(path.join(outputPath,'SIH26017_DATA_READINESS_LATEST.md'),markdown(report));
  fs.writeFileSync(path.join(outputPath,'SIH26017_DATA_DICTIONARY_LATEST.json'),JSON.stringify({datasetVersion,generatedAt:report.generatedAt,fields:dictionary},null,2));
  fs.writeFileSync(path.join(outputPath,'SIH26017_DATA_DICTIONARY_LATEST.md'),`# SIH26017 Data Dictionary\n\nDataset version: ${datasetVersion}\n\n| Source | Type | Missing % | Unique % | Suggested canonical fields |\n|---|---|---:|---:|---|\n${Object.values(dictionary).map(x=>`| ${x.sourceField} | ${x.type} | ${x.missingPct} | ${x.uniquePct} | ${(x.suggestions||[]).map(s=>s.canonical).join(', ')||'—'} |`).join('\n')}\n`);
  fs.writeFileSync(path.join(outputPath,'SIH26017_OUTCOME_REVIEW_LATEST.json'),JSON.stringify(outcome,null,2));
  fs.writeFileSync(path.join(outputPath,'SIH26017_OUTCOME_REVIEW_LATEST.md'),`# SIH26017 Outcome Review\n\nStatus: **${outcome.status}**\n\nFinal target is not selected by heuristics. Candidate families: ${outcome.allowedOutcomeFamilies.join(', ')}.\n\n${outcome.candidates.map(c=>`- ${c.file} :: ${c.field} → ${c.canonical} (${c.completenessPct}% complete)`).join('\n')||'- No candidate outcome fields identified.'}\n`);
  fs.writeFileSync(path.join(outputPath,'SIH26017_SPLIT_PLAN_LATEST.json'),JSON.stringify(split,null,2));
  fs.writeFileSync(path.join(outputPath,'SIH26017_SPLIT_PLAN_LATEST.md'),`# SIH26017 Temporal Split Plan\n\nMode: **${split.mode}**\n\nTrain: ${split.recommended.train}; Validation: ${split.recommended.validation}; Test: ${split.recommended.test}.\n\nRandom splitting is not recommended for the main evaluation. Final boundaries require source validation.\n`);
  fs.writeFileSync(path.join(outputPath,'SIH26017_PROVENANCE_LATEST.md'),`# SIH26017 Provenance\n\nDataset version: **${datasetVersion}**\n\nAll ingested files are classified as **USER_UPLOADED / NOT_GOVERNMENT_VERIFIED** until authorized provenance is established. Each source file is fingerprinted with SHA-256. No model training or promotion occurs in U46.\n\n## Source manifest\n\n${reports.map(f=>`- ${f.relativePath} — SHA-256 ${f.sha256} — ${f.bytes} bytes`).join('\n')}\n`);
  fs.writeFileSync(path.join(outputPath,'DATA_AUDIT.md'),markdown(report));
  fs.writeFileSync(path.join(outputPath,'DATA_DICTIONARY.md'),fs.readFileSync(path.join(outputPath,'SIH26017_DATA_DICTIONARY_LATEST.md'),'utf8'));
  fs.writeFileSync(path.join(outputPath,'PROVENANCE.md'),fs.readFileSync(path.join(outputPath,'SIH26017_PROVENANCE_LATEST.md'),'utf8'));
  fs.writeFileSync(path.join(outputPath,'MAPPING_REVIEW.md'),`# SIH26017 Mapping Review\n\nStatus: **${mappingReview.status}**\n\n${mappingReview.errors.length?mappingReview.errors.map(e=>`- ERROR: ${JSON.stringify(e)}`).join('\n'):'- No mapping errors detected.'}\n\nA valid mapping is still subject to source-document and human approval before training.\n`);
  return {report,jsonPath,mdPath};
}
if(require.main===module){try{const r=runPipeline({input:arg('input'),output:arg('output')}); console.log(`SIH26017 pipeline complete: ${path.relative(root,r.jsonPath)}`); console.log(`Readiness: ${r.report.readiness.status}`); console.log(`Files analysed: ${r.report.files.length}`);}catch(e){console.error(`ERROR: ${e.message}`);process.exit(2);}}
module.exports={runPipeline};

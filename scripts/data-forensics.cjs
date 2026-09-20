const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { DATA_INCOMING_DIR, DATA_FORENSICS_DIR, PROJECT_ROOT } = require('../backend/runtime-paths.cjs');

const root = PROJECT_ROOT;
const defaultInput = DATA_INCOMING_DIR;
const defaultOutput = path.join(DATA_FORENSICS_DIR, `report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find(v => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function listFiles(input) {
  if (fs.existsSync(input) && fs.statSync(input).isFile()) return [input];
  const out=[];
  if (!fs.existsSync(input)) return out;
  const stack=[input];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,ent.name);
      if(ent.isDirectory()) stack.push(full);
      else if(/\.(csv|tsv|json|ndjson|xlsx)$/i.test(ent.name)) out.push(full);
    }
  }
  return out.sort();
}

function splitCsv(line, delim=',') {
  const cells=[]; let cur=''; let quote=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quote && line[i+1]==='"'){cur+='"'; i++;}
      else quote=!quote;
    } else if(ch===delim && !quote){cells.push(cur); cur='';}
    else cur+=ch;
  }
  cells.push(cur);
  return cells.map(v=>v.trim());
}

function parseDelimited(text, delim=',') {
  const lines=text.split(/\r?\n/).filter(line=>line.trim().length>0);
  if(!lines.length) return {headers:[], rows:[]};
  const headers=splitCsv(lines[0],delim);
  const rows=lines.slice(1).map(line=>{
    const vals=splitCsv(line,delim); const obj={};
    headers.forEach((h,i)=>obj[h]=vals[i] ?? '');
    return obj;
  });
  return {headers,rows};
}

function parseXlsx(file) {
  const candidates = process.platform === 'win32' ? ['python','python3','py'] : ['python3','python'];
  let lastErr = null;
  for (const exe of candidates) {
    try { const r = cp.spawnSync(exe, ['scripts/xlsx-inspect.py', file], {cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe']}); if (r.status === 0 && r.stdout) return JSON.parse(r.stdout); lastErr = new Error((r.stderr || '').trim() || `Python exited ${r.status}`); } catch (e) { lastErr = e; }
  }
  throw new Error(`XLSX inspection requires Python 3: ${lastErr?.message || 'python not found'}`);
}

function parseFile(file) {
  const ext=path.extname(file).toLowerCase();
  if (ext === '.xlsx') return parseXlsx(file);
  const raw=fs.readFileSync(file,'utf8');
  if(ext==='.json'){
    const value=JSON.parse(raw);
    const rows=Array.isArray(value) ? value : (Array.isArray(value?.data) ? value.data : [value]);
    const headers=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
    return {headers,rows};
  }
  if(ext==='.ndjson'){
    const rows=raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    const headers=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
    return {headers,rows};
  }
  return parseDelimited(raw, ext==='.tsv'?'\t':',');
}

const DATE_RE=/(^|[_ -])(date|datetime|time|timestamp|year|month)([_ -]|$)|(^|_)(created|updated|started|ended|completed|approved|awarded|possessed|acquired)_?at$/i;
const ID_RE=/(^id$|_id$|code|number|no\.?$|identifier|survey|ulpin|cnr)/i;
const FUTURE_OUTCOME_RE=/(actual|completed|completion|delay|overrun|final|possession|award|payment|outcome)/i;

function inferType(values){
  const nonempty=values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(String);
  if(!nonempty.length) return 'empty';
  const nums=nonempty.filter(v=>Number.isFinite(Number(v))).length;
  if(nums/nonempty.length>=0.95) return 'numeric';
  const dateLike=nonempty.filter(v=>/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s].*)?$/.test(v) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(v) || /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(v)).length;
  if(dateLike===nonempty.length && nonempty.length>=2) return 'date_or_datetime';
  const bools=nonempty.filter(v=>/^(true|false|yes|no|0|1)$/i.test(v)).length;
  if(bools/nonempty.length>=0.95) return 'boolean_like';
  return 'text_or_categorical';
}


function normalizedName(name){ return String(name||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
function looksIdentifier(name){ return ID_RE.test(name) || /(project|parcel|segment|case|survey|khasra|village|district|state|agency|authority|department).*(id|code|number|no)$/i.test(name); }
function looksAdministrative(name){ return /(approval|approve|notification|award|payment|compensation|r&r|rehab|rehabilitation|resettlement|possession|scrutiny|acquisition|objection|corrig|send.?back|resubmission|correction|pending|status|stage|dispute|court|case)/i.test(name); }
function looksTarget(name){ return /(actual|outcome|completed|completion|delay|delayed|overrun|final|possession|award|payment|outcome|duration|days_to_completion|additional_days)/i.test(name); }
function profileNumeric(values){
  const nums=values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(Number).filter(Number.isFinite);
  if(!nums.length)return null;
  nums.sort((a,b)=>a-b);
  const q=(arr,p)=>arr[Math.min(arr.length-1,Math.max(0,Math.floor((arr.length-1)*p)))];
  return {count:nums.length,min:nums[0],p25:q(nums,.25),median:q(nums,.5),p75:q(nums,.75),max:nums[nums.length-1]};
}
function profileCategories(values){
  const vals=values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(v=>String(v));
  if(!vals.length)return null;
  const counts=new Map(); for(const v of vals)counts.set(v,(counts.get(v)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([value,count])=>({value,count,pct:Number((count/vals.length*100).toFixed(2))}));
}
function inferGrain(headers,stats,rows){
  const preferred=headers.filter(h=>looksIdentifier(h) && stats[h]?.uniqueCount>1);
  const candidates=[];
  for(const id of preferred.slice(0,15)){
    const card=stats[id];
    const uniqueness=card.uniquePct||0;
    candidates.push({field:id,role:'identifier_candidate',uniquenessPct:uniqueness,repeatObservationLikely:uniqueness<95});
  }
  if(preferred.some(h=>/project/i.test(h))) candidates.unshift({field:preferred.find(h=>/project/i.test(h)),role:'project_grain_candidate',reason:'project-like identifier field present'});
  if(preferred.some(h=>/parcel|survey|khasra/i.test(h))) candidates.push({field:preferred.find(h=>/parcel|survey|khasra/i.test(h)),role:'parcel_or_survey_grain_candidate',reason:'parcel/survey-like identifier field present'});
  return candidates.slice(0,12);
}
function buildDepthProfile(headers,rows,stats,dateRanges,possibleOutcomes){
  const numericProfiles={}, categoricalProfiles={}, columnRoles={};
  for(const h of headers){
    const role=[];
    if(looksIdentifier(h)) role.push('identifier_candidate');
    if(DATE_RE.test(h) || stats[h]?.type==='date_or_datetime') role.push('temporal_candidate');
    if(looksAdministrative(h)) role.push('process_or_workflow_signal');
    if(looksTarget(h)) role.push('possible_target_or_post_outcome_signal');
    columnRoles[h]=role;
    const type=stats[h]?.type;
    if(type==='numeric') numericProfiles[h]=profileNumeric(rows.map(r=>r?.[h]));
    if(type==='text_or_categorical' || type==='boolean_like') categoricalProfiles[h]=profileCategories(rows.map(r=>r?.[h]));
  }
  const entityCandidates=inferGrain(headers,stats,rows);
  const primaryEntity=entityCandidates.find(x=>x.role==='project_grain_candidate') || entityCandidates.find(x=>x.role==='identifier_candidate') || null;
  let repeatProfile=null;
  if(primaryEntity?.field){
    const counts=new Map(); for(const r of rows){const v=r?.[primaryEntity.field]; if(v!==null&&v!==undefined&&String(v).trim()!==''){const k=String(v);counts.set(k,(counts.get(k)||0)+1);}}
    const freq=[...counts.values()];
    repeatProfile={field:primaryEntity.field,entityCount:freq.length,repeatedEntityCount:freq.filter(n=>n>1).length,maxObservationsPerEntity:freq.length?Math.max(...freq):0};
  }
  const totalCells=Math.max(1,rows.length*headers.length);
  const missingCells=headers.reduce((a,h)=>a+(stats[h]?.missing||0),0);
  const temporalColumns=headers.filter(h=>DATE_RE.test(h)||stats[h]?.type==='date_or_datetime');
  const parsedDateCounts=temporalColumns.reduce((a,h)=>a+(dateRanges[h]?.parsedCount||0),0);
  return {
    profileVersion:'forensics-depth-v1',
    predictionGrainCandidates:entityCandidates,
    primaryEntityCandidate:primaryEntity,
    entityRepeatProfile:repeatProfile,
    columnRoles,
    numericProfiles,
    categoricalProfiles,
    temporalSummary:{dateColumnCount:temporalColumns.length,totalParsedDateValues:parsedDateCounts,coveragePct:Number((parsedDateCounts/Math.max(1,rows.length*temporalColumns.length)*100).toFixed(2))},
    candidateFeatureColumns:headers.filter(h=>!possibleOutcomes.includes(h) && !looksTarget(h) && !looksIdentifier(h)).slice(0,100),
    candidateTargetColumns:possibleOutcomes.slice(0,50),
    leakageReview:{rule:'Any target/post-outcome field, or any event unavailable by prediction_time, must be excluded from as-of features.',suspectedFields:[...new Set(headers.filter(h=>looksTarget(h)).concat(possibleOutcomes))].slice(0,100),requiresTemporalAvailabilityAudit:true},
    completeness:{cellCompletenessPct:Number(((totalCells-missingCells)/totalCells*100).toFixed(2)),rowCount:rows.length,columnCount:headers.length},
    readiness:{status:'FORENSIC_ONLY',modelTrainingAllowed:false,note:'Structural profiling only. Human/source validation and temporal label definition are still required before model training.'}
  };
}

function analyseRows(headers,rows,file,format,sourceFile=file){
  const stat={};
  for(const h of headers){
    const vals=rows.map(r=>r?.[h]);
    const nonempty=vals.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='');
    const unique=new Set(nonempty.map(v=>String(v))).size;
    const type=inferType(vals);
    const candidateFlags=[];
    if(DATE_RE.test(h) || type==='date_or_datetime') candidateFlags.push('date_candidate');
    if(ID_RE.test(h)) candidateFlags.push('identifier_candidate');
    if(FUTURE_OUTCOME_RE.test(h)) candidateFlags.push('possible_outcome_or_target_field');
    stat[h]={type,missing:rows.length-nonempty.length,missingPct:rows.length?Number(((rows.length-nonempty.length)/rows.length*100).toFixed(2)):0,uniqueCount:unique,uniquePct:rows.length?Number((unique/rows.length*100).toFixed(2)):0,flags:candidateFlags};
  }
  const likelyIds=headers.filter(h=>stat[h].flags.includes('identifier_candidate'));
  const dateColumns=headers.filter(h=>stat[h].flags.includes('date_candidate'));
  const possibleOutcomes=headers.filter(h=>stat[h].flags.includes('possible_outcome_or_target_field'));
  const exactRowHashes=new Map();
  for(const row of rows){ const hash=crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex'); exactRowHashes.set(hash,(exactRowHashes.get(hash)||0)+1); }
  const duplicateRows=[...exactRowHashes.values()].filter(n=>n>1).reduce((a,n)=>a+n,0);
  const grainClues={possibleIdentifiers:likelyIds.slice(0,20),dateColumns:dateColumns.slice(0,20),possibleOutcomeFields:possibleOutcomes.slice(0,30)};
  const dateRanges={};
  for(const h of dateColumns){ const vals=rows.map(r=>r?.[h]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(String); const parsed=vals.map(v=>Date.parse(v)).filter(Number.isFinite); if(parsed.length) dateRanges[h]={min:new Date(Math.min(...parsed)).toISOString(),max:new Date(Math.max(...parsed)).toISOString(),parsedCount:parsed.length}; }
  const labelFeasibility=possibleOutcomes.map(h=>({field:h,completenessPct:Number((100-stat[h].missingPct).toFixed(2)),uniquenessPct:stat[h].uniquePct,assessment:stat[h].missingPct<=20?'candidate_requires_source_validation':'weak_or_incomplete_candidate'}));
  const leakageRisks=possibleOutcomes.map(h=>({field:h,reason:'Name-based heuristic only; exclude from as-of features if the field reflects post-as-of information.',requiresReview:true}));
  return {file:path.relative(root,file),format,sha256:crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'),bytes:fs.statSync(sourceFile).size,rows:rows.length,columns:headers.length,headers,columns:stat,duplicateRowCount:duplicateRows,grainClues,dateRanges,labelFeasibility,leakageRisks,depthProfile:buildDepthProfile(headers,rows,stat,dateRanges,possibleOutcomes)};
}

function analyseFile(file){
  const ext=path.extname(file).toLowerCase();
  if(ext==='.xlsx'){ const sheets=parseXlsx(file); return {file:path.relative(root,file),format:'xlsx',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),bytes:fs.statSync(file).size,sheetCount:sheets.length,sheets:sheets.map(s=>analyseRows(s.headers,s.rows,file+'#'+s.sheet,'xlsx-sheet',file))}; }
  const {headers,rows}=parseFile(file);
  return analyseRows(headers,rows,file,ext.slice(1).toLowerCase());
}

function buildForensicsReport(inputPath, {generatedAt=new Date().toISOString()}={}) {
  const input=path.resolve(root,inputPath);
  const files=listFiles(input);
  if(!files.length){
    throw new Error(`No CSV/TSV/JSON/NDJSON/XLSX files found at ${path.relative(root,input) || '.'}.`);
  }
  const reports=[];
  for(const file of files){
    try { reports.push(analyseFile(file)); }
    catch(e){ reports.push({file:path.relative(root,file),error:e?.message||String(e)}); }
  }
  const analysed=reports.filter(r=>!r.error);
  return {
    schemaVersion:'1.2',
    generatedAt,
    inputPath:path.relative(root,input),
    files:reports,
    summary:{
      filesFound:reports.length,
      filesAnalysed:analysed.length,
      filesFailed:reports.length-analysed.length,
      rowsObserved:reports.reduce((a,r)=>a+(Number(r.rows)||0)+(Array.isArray(r.sheets)?r.sheets.reduce((b,s)=>b+(Number(s.rows)||0),0):0),0),
      columnsObserved:reports.reduce((a,r)=>a+(Number(r.columns)||0)+(Array.isArray(r.sheets)?r.sheets.reduce((b,s)=>b+(Number(s.columns)||0),0):0),0),
    },
    methodology:{
      purpose:'Structural dataset reconnaissance only; not a proof of label correctness or model suitability.',
      supportedFormats:['csv','tsv','json','ndjson','xlsx'],
      xlsxNote:'XLSX inspection uses Python standard-library ZIP/XML parsing; no third-party Python package is required.',
      futureOutcomeHeuristics:'Field-name flags are advisory only and require human verification against source documentation.',
      noModelClaims:true,
    }
  };
}

function writeForensicsReport(inputPath, outputPath) {
  const report=buildForensicsReport(inputPath);
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(report,null,2),'utf8');
  return report;
}

function main(){
  const inputRaw=argValue('input') || process.env.BHOOMI_FORENSICS_INPUT || defaultInput;
  const outputRaw=argValue('output') || process.env.BHOOMI_FORENSICS_OUTPUT || defaultOutput;
  const input=path.resolve(root,inputRaw);
  const output=path.resolve(root,outputRaw);
  try {
    const report=writeForensicsReport(input,output);
    console.log(`Forensics report written: ${path.relative(root,output)}`);
    console.log(`Files analysed: ${report.summary.filesAnalysed}/${report.summary.filesFound}`);
    console.log(`Rows observed: ${report.summary.rowsObserved}`);
    if(report.summary.filesFailed) console.error(`Files with forensic errors: ${report.summary.filesFailed}`);
  } catch(error) {
    console.error(`DATA_FORENSICS_FATAL: ${error?.stack||error}`);
    process.exitCode=2;
  }
}

module.exports={
  listFiles,
  parseFile,
  analyseFile,
  buildForensicsReport,
  writeForensicsReport,
};

if(require.main===module) main();

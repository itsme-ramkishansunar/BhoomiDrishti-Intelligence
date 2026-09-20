const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'config','ml-training-schema.json'),'utf8'));
const input=process.env.BHOOMI_ML_TRAINING_INPUT||path.join(root,'backend','data','prepared','sih26017_ml_ready.json');
const output=process.env.BHOOMI_ML_OUTPUT||path.join(root,'backend','data','ml');
function fail(msg){console.error(`ML TRAINING BLOCKED: ${msg}`);process.exit(2)}
if(!fs.existsSync(input)) fail(`prepared ML dataset not found at ${path.relative(root,input)}. Run the reviewed data-preparation stage first.`);
let payload;try{payload=JSON.parse(fs.readFileSync(input,'utf8'));}catch(e){fail(`invalid JSON dataset: ${e.message}`)}
if(payload.synthetic===true || String(payload.dataClass||'').toLowerCase()==='synthetic') fail('synthetic data cannot be promoted to production training.');
const rows=Array.isArray(payload.rows)?payload.rows:payload;
if(!Array.isArray(rows)||rows.length<10) fail('insufficient reviewed training rows.');
for(const f of schema.requiredFields) if(!rows.every(r=>r&&r[f]!==undefined&&r[f]!==null&&String(r[f]).trim()!=='')) fail(`required field missing: ${f}`);
const labels=rows.map(r=>Number(r.label));if(!labels.every(x=>x===0||x===1))fail('label must be binary 0/1.');
const featureKeys=(payload.featureKeys||Object.keys(schema.fieldDefinitions).filter(k=>['stage_index','days_in_stage','families_pending_ratio','legal_exposure','approval_gap','documentation_gap','rr_gap','administrative_friction'].includes(k))).filter(k=>rows.some(r=>Number.isFinite(Number(r[k]))));
if(featureKeys.length<3)fail('at least three reviewed numeric features are required.');
(async()=>{
const {projectTemporalSplit,fitLogistic,evaluateModel}=await import('../backend/domain/ml-baseline.js');
const split=projectTemporalSplit(rows); if(split.train.length<5||split.validation.length<3||split.test.length<3)fail('temporal project cohorts are too small for safe evaluation.');
const model=fitLogistic(split.train,featureKeys); const validation=evaluateModel(model,split.validation); const test=evaluateModel(model,split.test);
const artifact={schemaVersion:'ml-training-artifact-v1',model,split:{mode:split.mode,projects:split.projects,rows:{train:split.train.length,validation:split.validation.length,test:split.test.length}},evaluation:{validation,test},dataClass:payload.dataClass||'authorized_reviewed',trainedAt:new Date().toISOString(),productionPromotionAllowed:false,productionStatus:'CANDIDATE_UNTIL_CALIBRATION_OOD_APPROVAL'};
fs.mkdirSync(output,{recursive:true});artifact.artifactSha256=crypto.createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
fs.writeFileSync(path.join(output,'candidate-model-v1.json'),JSON.stringify(artifact,null,2));
console.log(JSON.stringify({status:'TRAINED_CANDIDATE',modelVersion:model.version,featureKeys,split:artifact.split,evaluation:artifact.evaluation,artifactSha256:artifact.artifactSha256,productionPromotionAllowed:false},null,2));
})().catch(e=>{console.error(`ML TRAINING FAILED: ${e.message}`);process.exit(1)});

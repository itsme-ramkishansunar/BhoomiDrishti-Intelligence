const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function assert(condition, label){ if(!condition) throw new Error(`FAIL ${label}`); console.log(`PASS intelligence-preparation contract: ${label}`); }
const file = fs.readFileSync(path.join(root,'backend','domain','intelligence-preparation.js'),'utf8');
const server = fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
assert(file.includes('INTELLIGENCE_PREPARATION_VERSION'),'version');
assert(file.includes('PREDICTION_GATE_NOT_VALIDATED'),'prediction gate');
assert(file.includes('reviewReasons'),'review reasons');
assert(file.includes('predictiveNotValidated'),'predictive status normalization');
assert(file.includes('runSha256'),'run hash');
assert(server.includes("/api/project-intake/:id/prepare-intelligence"),'server route');
assert(server.includes('prepareSIH26017Intelligence'),'server orchestration');
assert(server.includes("project_intake.intelligence_prepared"),'audit event');

(async()=>{
  const mod = await import('../backend/domain/intelligence-preparation.js');
  const prepared = mod.prepareSIH26017Intelligence({
    intake:{id:'I-TEST',documentCount:1,sourceClassification:'USER_UPLOADED'},
    canonical:{id:'C-TEST',readinessPct:90,quality:{evidenceCoveragePct:90,conflictCount:0},canonical:{entities:[],links:[],quality:{conflictCount:0}}},
    temporalSnapshot:{id:'T-TEST',snapshot:{quality:{qualityPct:95,conflictCount:0},events:[]}},
    predictiveStatus:'candidate_not_validated'
  });
  assert(prepared.gate==='PREDICTION_GATE_NOT_VALIDATED','candidate-not-validated prediction gate');
  assert(prepared.predictive.modelTrainability==='blocked_pending_real_authorized_dataset','model trainability gate');
  console.log('Intelligence preparation behavior check passed.');
})().catch(error=>{ console.error(error); process.exit(1); });

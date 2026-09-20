const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function assert(c,l){if(!c)throw new Error(`FAIL ${l}`);console.log(`PASS ml-governance contract: ${l}`)}
const file=fs.readFileSync(path.join(root,'backend/domain/ml-governance.js'),'utf8');
assert(file.includes('ML_GOVERNANCE_VERSION'),'version');assert(file.includes('evaluatePromotionGate'),'promotion gate');assert(file.includes('AUTHORIZED_REAL_DATA'),'real data gate');assert(file.includes('CALIBRATION_VALIDATED'),'calibration gate');assert(file.includes('OOD_APPLICABILITY_CHECKED'),'OOD gate');assert(file.includes('persistReadiness'),'readiness persistence');
(async()=>{const mod=await import('../backend/domain/ml-governance.js');const blocked=mod.evaluatePromotionGate({});assert(blocked.status==='BLOCKED','empty gate blocks');assert(blocked.productionPromotionAllowed===false,'promotion blocked');const pass=mod.evaluatePromotionGate(Object.fromEntries(mod.requiredProductionGates().map((x,i)=>[Object.keys(mod.evaluatePromotionGate({}).gates)[i],true])));assert(pass.status==='ELIGIBLE_FOR_HUMAN_APPROVAL','complete gate eligible');
const unverified=mod.buildReadinessFromForensics({files:[{file:'upload.xlsx',sourceClassification:'USER_UPLOADED / NOT_GOVERNMENT_VERIFIED',grainClues:{possibleIdentifiers:['project_id']},dateRanges:{start_date:{min:'2024-01-01',max:'2024-01-02'}}}]});
assert(unverified.datasetStatus==='FILES_DETECTED_BUT_NOT_AUTHORIZED_FOR_PROMOTION','unverified data is not promotable');
assert(unverified.gate.productionPromotionAllowed===false,'unverified files block promotion');console.log('ML governance behavior check passed.')})().catch(e=>{console.error(e);process.exit(1)});

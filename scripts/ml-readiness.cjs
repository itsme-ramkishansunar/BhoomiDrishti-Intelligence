const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
const { buildReadinessFromForensics, persistReadiness } = await import('../backend/domain/ml-governance.js');
const input=process.env.BHOOMI_FORENSICS_OUTPUT||path.join(root,'backend','data','forensics','SIH26017_DATA_READINESS_LATEST.json');
let forensics=null; if(fs.existsSync(input)){try{forensics=JSON.parse(fs.readFileSync(input,'utf8'));}catch(e){console.error(`ERROR: Unable to parse forensics report: ${e.message}`);process.exit(2)}}
const readiness=buildReadinessFromForensics(forensics, null, null, null);const file=persistReadiness(readiness);
console.log(`ML readiness report: ${path.relative(root,file)}`);console.log(JSON.stringify(readiness,null,2));
if(readiness.gate.productionPromotionAllowed) console.log('ML readiness: ELIGIBLE_FOR_HUMAN_APPROVAL'); else console.log('ML readiness: BLOCKED (expected until real authorized data and validation gates are satisfied)');
})().catch(e=>{console.error(`ML readiness failed: ${e.message}`);process.exit(1)});

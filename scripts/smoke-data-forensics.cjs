const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const engine=fs.readFileSync(path.join(root,'scripts','data-forensics.cjs'),'utf8');
for(const t of ['BHOOMI_FORENSICS_INPUT','BHOOMI_FORENSICS_OUTPUT','possible_outcome_or_target_field','possibleIdentifiers','dateRanges','labelFeasibility','leakageRisks','xlsx','noModelClaims']){
  if(!engine.includes(t)) throw new Error(`Missing data-forensics contract: ${t}`);
  console.log(`PASS data-forensics contract: ${t}`);
}
for(const f of ['backend/seed-projects.json','scripts/data-forensics.cjs','scripts/xlsx-inspect.py','README.md']){
  if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing forensic fixture/file: ${f}`);
  console.log(`PASS file: ${f}`);
}
console.log('Data forensics smoke source check passed.');

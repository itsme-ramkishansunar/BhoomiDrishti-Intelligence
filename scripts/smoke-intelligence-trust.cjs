const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'backend/domain/intelligence-trust.js');
if(!fs.existsSync(file)) throw new Error('Missing intelligence trust module');
const t=fs.readFileSync(file,'utf8');
for(const token of ['INTELLIGENCE_TRUST_VERSION','calculateEvidenceReadiness','calculatePredictionApplicability','buildPredictionDiff','Prediction diff compares stored model outputs']) if(!t.includes(token)) throw new Error(`Missing intelligence-trust contract: ${token}`);
console.log('Intelligence trust smoke source check passed.');

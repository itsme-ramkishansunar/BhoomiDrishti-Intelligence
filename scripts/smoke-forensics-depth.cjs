const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'scripts/data-forensics.cjs'),'utf8');
const checks={
  depthProfile:'profileVersion:\'forensics-depth-v1\'',
  grain:'predictionGrainCandidates',
  repeat:'entityRepeatProfile',
  numeric:'numericProfiles',
  categories:'categoricalProfiles',
  temporal:'temporalSummary',
  candidateFeatures:'candidateFeatureColumns',
  candidateTargets:'candidateTargetColumns',
  leakage:'requiresTemporalAvailabilityAudit',
  readiness:'modelTrainingAllowed:false'
};
for(const [k,v] of Object.entries(checks)){if(!script.includes(v))throw new Error(`Missing forensic-depth contract: ${k}`);console.log(`PASS forensic-depth contract: ${k}`)}
if(!script.includes("schemaVersion:'1.1'"))throw new Error('Forensics schema version was not advanced');
console.log('Dataset forensic depth smoke source check passed.');

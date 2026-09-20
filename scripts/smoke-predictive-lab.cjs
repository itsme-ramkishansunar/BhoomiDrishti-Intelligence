const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const checks=[
 ['lab domain','backend/domain/predictive-lab.js',['PREDICTIVE_LAB_VERSION','buildFeatureVector','buildCandidateSurvivalCurve','buildPredictiveLabSnapshot','buildProjectLabPrediction','productionPromotionAllowed: false']],
 ['lab UI','src/components/ops/PredictiveLabPage.jsx',['Predictive Intelligence Lab','Build research artifact','SAFE BY DEFAULT','/api/ml/lab','/api/ml/lab/build-artifact','/api/predictive/dataset/build']],
 ['server routes','backend/server.js',['/api/ml/lab','/api/ml/lab/projects/:id','/api/ml/lab/build-artifact','/api/predictive/dataset/build','buildPredictiveLabSnapshot']],
 ['app navigation','src/App.jsx',['PredictiveLabPage','predictive-lab','view === "predictive-lab"']],
 ['motion system','src/index.css',['bdReveal','bd-pipeline','prefers-reduced-motion']],
 ['artifact builder','scripts/build-predictive-research-artifact.cjs',['projectTemporalSplit','fitLogistic','buildResearchArtifact','synthetic data cannot','reviewed ML dataset not found']],
];
let failed=0;for(const [name,file,tokens] of checks){const p=path.join(root,file);if(!fs.existsSync(p)){console.error(`FAIL ${name}: ${file}`);failed++;continue;}const s=fs.readFileSync(p,'utf8');for(const t of tokens){if(!s.includes(t)){console.error(`FAIL ${name}: missing ${t}`);failed++;}else console.log(`PASS ${name}: ${t}`)}}
if(failed){process.exit(1)}console.log('Predictive lab smoke PASSED');

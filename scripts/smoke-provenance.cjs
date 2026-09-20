(async () => {
const mod = await import('../backend/domain/provenance.js');
const cases = [
  ['synthetic_demo','SYNTHETIC'],
  ['user_uploaded','USER_UPLOADED'],
  ['USER_UPLOADED / NOT_GOVERNMENT_VERIFIED','USER_UPLOADED'],
  ['official_export','OFFICIAL'],
  ['official_api','OFFICIAL'],
  ['derived','DERIVED'],
  ['simulated_scenario','SIMULATED'],
  ['cached','CACHED'],
  ['', 'UNVERIFIED'],
];
for (const [input, expected] of cases) {
  const actual = mod.classifySourceLabel(input);
  if (actual !== expected) throw new Error(`Provenance mismatch for ${input}: ${actual} != ${expected}`);
  console.log(`PASS provenance: ${input || '<empty>'} -> ${actual}`);
}
const intelligence = await import('../backend/domain/intelligence.js');
const evidence = intelligence.buildEvidence({
  source:{label:'user_uploaded'},
  familiesPending:1,familiesAffected:2,docsMissing:1,disputes:1,courtCases:1,
  risk:{overall:50,band:'medium'}
});
for (const e of evidence.filter(x=>x.id!=='E-RISK')) {
  if (e.provenance !== 'USER_UPLOADED') throw new Error(`Evidence provenance leaked: ${e.id} -> ${e.provenance}`);
}
console.log('PASS provenance: user-uploaded evidence never becomes OFFICIAL');

})().catch((error) => { console.error(`ERROR: ${error.message}`); process.exit(1); });

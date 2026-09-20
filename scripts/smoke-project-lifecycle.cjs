const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'backend/domain/project-lifecycle.js'), 'utf8');
for (const token of ["buildProjectBootstrap", "PROJECT_LIFECYCLE_VERSION", "app.post('/api/projects'", 'bootstrap', 'persistCandidatePrediction', 'upsertOperationalAlert', 'createRecommendation']) {
  if (!server.includes(token) && !lifecycle.includes(token)) throw new Error(`Missing automatic lifecycle contract: ${token}`);
  console.log(`PASS project-lifecycle contract: ${token}`);
}
for (const token of ['compensation','legal','documentation','approval','resettlement','administrative','process_silence']) {
  if (!lifecycle.includes(`${token}:`)) throw new Error(`Missing signal action mapping: ${token}`);
  console.log(`PASS lifecycle action mapping: ${token}`);
}
console.log('Project lifecycle automation smoke PASSED');

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const predictive = fs.readFileSync(path.join(root, 'src/components/project/PredictiveIntelligencePanel.jsx'), 'utf8');
const db = fs.readFileSync(path.join(root, 'backend/db.js'), 'utf8');

for (const token of [
  'fetch("/api/projects"',
  'body: JSON.stringify(project)',
  'setProjects((prev) => [...added, ...prev])',
]) {
  if (!app.includes(token)) throw new Error(`Missing automatic project creation contract: ${token}`);
  console.log(`PASS new-project automation frontend: ${token}`);
}
for (const token of [
  "app.post('/api/projects'",
  "app.get('/api/projects/:id/predictive-intelligence'",
  "app.get('/api/projects/:id/early-warning'",
  "app.get('/api/projects/:id/evidence'",
  "app.get('/api/projects/:id/recommendations'",
  "app.get('/api/projects/:id/workflow'",
  "app.get('/api/projects/:id/legal-clocks'",
  "app.get('/api/projects/:id/interventions'",
]) {
  if (!server.includes(token)) throw new Error(`Missing project-id automation route: ${token}`);
  console.log(`PASS new-project automation backend: ${token}`);
}
for (const token of [
  'project.id',
  'ResponsiveContainer',
  'LineChart',
  'BarChart',
  'dataKey="likelihoodPct"',
  'dataKey="contribution"',
]) {
  if (!predictive.includes(token)) throw new Error(`Missing graphical project intelligence contract: ${token}`);
  console.log(`PASS predictive graphics contract: ${token}`);
}
for (const token of ['risk:read', 'projects:edit', 'workflow:read', 'workflow:action']) {
  if (!server.includes(token)) throw new Error(`Missing authorization contract: ${token}`);
}
if (!db.includes('return { ...project, risk: computeRisk(project) };')) throw new Error('Project-derived risk contract missing.');
console.log('New-project automation + predictive graphics smoke PASSED');

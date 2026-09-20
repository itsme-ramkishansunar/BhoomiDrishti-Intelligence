const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
for (const token of ["const AI_LOCAL_FIRST", "function localAssistant", "app.post('/api/ai/chat'"]) { if (!server.includes(token)) throw new Error('AI smoke check missing: '+token); }
console.log('AI smoke source check passed: local-first route and evidence engine are present.');

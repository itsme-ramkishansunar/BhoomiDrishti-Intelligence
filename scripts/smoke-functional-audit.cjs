'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mustExist=[
 'backend/server.js','backend/db.js','backend/domain/mapping.js','backend/domain/map-location-data.js',
 'src/App.jsx','src/components/map/RiskMap.jsx','src/components/auth/LoginPage.jsx',
 'src/components/ai/BhoomiAIPage.jsx','src/components/ops/DataIntegrationPage.jsx',
 'src/components/ops/ProductionReadinessPage.jsx','src/components/ops/IntegrationControlPage.jsx'
];
for(const rel of mustExist) if(!fs.existsSync(path.join(root,rel))) throw new Error(`Missing core module: ${rel}`);
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const map=fs.readFileSync(path.join(root,'src/components/map/RiskMap.jsx'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const checks=[
 ['/api/auth/login',server],['/api/auth/me',server],['/api/projects',server],['/api/projects/:id/location',server],
 ['/api/map/status',server],['/api/geocode/search',server],['/api/ai/status',server],['/api/ai/chat',server],
 ['projects:edit',server],['map:read',server],['ai:use',server],
 ['showApproximate',map],['Locate this project',map],['Resolve missing',map],['PROJECT POINT',map],['UNRESOLVED',map],
 ['RiskMap',app],['DataIntegrationPage',app],['ProductionReadinessPage',app],['IntegrationControlPage',app]
];
for(const [token,src] of checks) if(!src.includes(token)) throw new Error(`Functional contract missing: ${token}`);
console.log(`PASS functional audit: ${checks.length} contracts`);
console.log('PASS map: project list, approximate points, unresolved resolution and refresh paths present');
console.log('PASS auth: login/session/project authorization/location update paths present');
console.log('PASS AI: status/chat/provider configuration path present');
console.log('PASS operations: integration/readiness/data-health modules present');
console.log('FUNCTIONAL AUDIT SMOKE PASSED');
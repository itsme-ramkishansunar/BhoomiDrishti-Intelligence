const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const required=[
 'backend/domain/portfolio-intelligence.js',
 'src/components/ops/NationalIntelligencePage.jsx',
 'scripts/smoke-national-intelligence.cjs'
];
for(const f of required){if(!fs.existsSync(path.join(root,f))){console.error(`FAIL missing: ${f}`);process.exit(1)} console.log(`PASS national-intelligence artifact: ${f}`)}
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
for(const token of ["/api/portfolio/intelligence","/api/portfolio/export.csv","buildPortfolioIntelligence"]){if(!server.includes(token)){console.error(`FAIL server contract: ${token}`);process.exit(1)} console.log(`PASS national-intelligence server contract: ${token}`)}
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
for(const token of ['NationalIntelligencePage','view === "national-intelligence"']){if(!app.includes(token)){console.error(`FAIL UI contract: ${token}`);process.exit(1)} console.log(`PASS national-intelligence UI contract: ${token}`)}
console.log('National intelligence integration smoke PASSED');

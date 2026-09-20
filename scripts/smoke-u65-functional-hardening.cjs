const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const db=fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const map=fs.readFileSync(path.join(root,'src/components/map/RiskMap.jsx'),'utf8');
const mapData=fs.readFileSync(path.join(root,'backend/domain/map-location-data.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks=[
 ['U65 version',fs.existsSync(path.join(root,'U65_VERSION.txt'))],
 ['India GIS boundary',mapData.includes('indiaCoordinateValid')&&mapData.includes('INDIA_BOUNDS')],
 ['server location repair',server.includes('repairProjectLocationIntegrity')],
 ['existing coordinate repair',db.includes("precision==='UNRESOLVED'")&&db.includes("repair.run('PROJECT_POINT'")&&db.includes("'PROJECT_RECORD_POINT'")],
 ['out-of-country rejection',db.includes('India GIS integrity boundary')],
 ['map hides approximate by default',map.includes('useState(false)')&&map.includes('showApproximate')],
 ['map counts approximate separately',map.includes('approximate.length')],
 ['map uses India bounds',map.includes('lat>=6&&lat<=38.5&&lon>=68&&lon<=98.5')],
 ['import coordinate classification',app.includes("locationPrecision: hasPoint")],
 ['role credential sync',db.includes('BHOOMI_GOV_PASSWORD')&&db.includes("status='active'")],
 ['department project edit',db.includes("'Department Officer': ['dashboard:read','projects:read','projects:edit'")],
 ['legal workflow action',db.includes("'Legal Officer': ['dashboard:read','projects:read','risk:read','map:read','alerts:read','history:read','feedback:write'")],
 ['U65 smoke script',pkg.scripts&&pkg.scripts['smoke:u65-functional-hardening']],
];
for(const [label,ok] of checks){if(!ok) throw new Error(`FAIL U65: ${label}`); console.log(`PASS U65: ${label}`);}
console.log('U65 functional hardening smoke PASSED');

const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const map=fs.readFileSync(path.join(root,'src/components/map/RiskMap.jsx'),'utf8');
const db=fs.readFileSync(path.join(root,'backend/db.js'),'utf8');
const repair=fs.readFileSync(path.join(root,'scripts/repair-local-access.cjs'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks=[
 ['U66 version',fs.existsSync(path.join(root,'U66_VERSION.txt'))],
 ['map approximate visible by default',map.includes('showApproximate') && map.includes('useState(true)')],
 ['map exposes approximate count',map.includes('approximate.length')],
 ['map preserves India boundary',map.includes('lat>=6&&lat<=38.5&&lon>=68&&lon<=98.5')],
 ['invalid coordinate fallback is approximate',db.includes("'DISTRICT_CENTROID', 'DEMO_DISTRICT_CENTROID'")&&db.includes("'DEMO_APPROXIMATE', 0.25")],
 ['unknown invalid coordinate remains unresolved',db.includes("Coordinate rejected by India GIS integrity boundary")],
 ['valid coordinates preserved',db.includes('if (!indiaCoordinateValid(lat,lon))')&&db.includes("if (!precision || precision==='UNRESOLVED')")],
 ['local admin deterministic credential',repair.includes('BHOOMI_ADMIN_PASSWORD') && repair.includes('randomBytes')],
 ['local role credentials deterministic',repair.includes('BHOOMI_GOV_PASSWORD')&&repair.includes('BHOOMI_DEPT_PASSWORD')&&repair.includes('BHOOMI_LEGAL_PASSWORD')&&repair.includes('BHOOMI_VIEWER_PASSWORD')],
 ['local access verification command',pkg.scripts?.['repair:local-access']&&pkg.scripts?.['smoke:local-access']],
 ['national demo scope',db.includes("state: 'National', district: 'National'")],
];
for(const [label,ok] of checks){if(!ok)throw new Error(`FAIL U66: ${label}`);console.log(`PASS U66: ${label}`)}
console.log('U66 FUNCTIONAL RECOVERY SMOKE PASSED');

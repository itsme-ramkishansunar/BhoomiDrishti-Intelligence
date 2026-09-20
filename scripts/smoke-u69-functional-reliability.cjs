const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}
function pass(label,ok){if(!ok)throw new Error(`FAIL U69: ${label}`);console.log(`PASS U69: ${label}`);}
function main(){
 const map=read('src/components/map/RiskMap.jsx');
 const pred=read('src/components/project/PredictiveIntelligencePanel.jsx');
 const dash=read('src/components/dashboard/DashboardPage.jsx');
 const pkg=JSON.parse(read('package.json'));
 pass('U69 version',fs.existsSync(path.join(root,'U69_VERSION.txt')) && pkg.version.includes('upgrade69'));
 pass('transient district fallback',map.includes('districtFallback')&&map.includes('visual fallback only')&&map.includes('not stored'));
 pass('India bounds control',map.includes('INDIA_BOUNDS')&&map.includes('Fit data')&&map.includes('mapReady'));
 pass('map resize reliability',map.includes("window.addEventListener('resize',resize)")&&map.includes('map.invalidateSize()'));
 pass('unresolved projects remain actionable',map.includes('Resolve missing')&&map.includes('Locate this project'));
 pass('predictive chart hook order',pred.indexOf('const [selectedChartPoint, setSelectedChartPoint] = useState(null);') < pred.indexOf('if (state.loading)'));
 pass('predictive trajectory click',pred.includes('kind:"trajectory"'));
 pass('predictive driver click',pred.includes('kind:"driver"'));
 pass('dashboard donut interaction',dash.includes('onClick={(_, index)=>setSelectedRisk'));
 pass('dashboard state-risk interaction',dash.includes('onClick={(entry)=>onSelect'));
 pass('no U69 migration',!fs.readdirSync(path.join(root,'database','migrations')).some(f=>/069|u69/i.test(f)));
 console.log('U69 MAP AND INTERACTION RELIABILITY SMOKE PASSED');
}
main();

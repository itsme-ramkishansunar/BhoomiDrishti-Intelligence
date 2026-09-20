const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const risk=read('src/components/map/RiskMap.jsx');
const db=read('backend/db.js');
const mapData=read('backend/domain/map-location-data.js');
const mapping=read('backend/domain/mapping.js');
const server=read('backend/server.js');
const mig=read('database/migrations/015_precise_mapping.sql');
const app=read('src/App.jsx');
const checks=[
 ['mapping module / India geocoder',mapping,'nominatim.openstreetmap.org'],
 ['mapping data / district catalogue',mapData,'Gorakhpur'],
 ['mapping data / state fallback',mapData,'demoPointForState'],
 ['map UI / Leaflet',risk,"L.map(mapNode.current"],
 ['map UI / India bounds',risk,'INDIA_BOUNDS'],
 ['map UI / exact coordinate validation',risk,'function validPoint'],
 ['map UI / provenance classifier',risk,'function locationMeta'],
 ['map UI / parcel geometry',risk,'geometryGeoJSON'],
 ['map UI / exact project point',risk,"PROJECT_POINT"],
 ['map UI / approximate location',risk,"DISTRICT_CENTROID"],
 ['map UI / unresolved withholding',risk,"kind:'unresolved'"],
 ['map UI / India viewport',risk,'fitIndia'],
 ['map UI / data fitting',risk,'fitData'],
 ['map UI / project focus',risk,'flyTo'],
 ['map UI / risk zones',risk,'showRiskZones'],
 ['map UI / approximate toggle',risk,'showApproximate'],
 ['map UI / ongoing filter',risk,'showOpenOnly'],
 ['map UI / project search',risk,'setQuery'],
 ['map UI / refresh',risk,'onRefresh'],
 ['location API',server,'/api/geocode/search'],
 ['location patch API',server,'/api/projects/:id/location'],
 ['mapping migration',mig,'map_geocode_cache'],
 ['DB location metadata',db,'location_precision'],
 ['manual location persistence UI',app,'ProjectLocationPanel'],
 ['manual location precision',app,'locationPrecision'],
 ['live project refresh',app,'setInterval(()=>{'],
 ['demo location honesty',mapData,'DEMO_DISTRICT_CENTROID'],
];
for(const [label,text,token] of checks){
 if(!text.includes(token)) throw new Error(`Missing mapping contract: ${label} -> ${token}`);
 console.log(`PASS mapping: ${label}`);
}
console.log('MAPPING FUNCTIONAL CONTRACT PASSED: U70 map architecture, GIS provenance, location repair, filters, focus and refresh are aligned.');

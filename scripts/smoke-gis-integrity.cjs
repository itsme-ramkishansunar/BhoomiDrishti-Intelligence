'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const map=fs.readFileSync(path.join(root,'src/components/map/RiskMap.jsx'),'utf8');
const domain=fs.readFileSync(path.join(root,'backend/domain/map-location-data.js'),'utf8');
for(const token of ['geometryGeoJSON','locationPrecision','DEMO_DISTRICT_CENTROID','coordinatePairValid','showApproximate','indiaCoordinateValid']) if(!map.includes(token)&&!domain.includes(token)) throw new Error(`GIS contract missing ${token}`);
if(/map_x[^\n]*map_y/.test(map)) throw new Error('RiskMap references schematic map_x/map_y');
console.log('GIS integrity smoke PASSED');

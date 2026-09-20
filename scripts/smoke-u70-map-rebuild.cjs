#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const risk=read('src/components/map/RiskMap.jsx');
const loc=read('backend/domain/map-location-data.js');
const db=read('backend/db.js');
const repair=read('scripts/repair-local-access.cjs');
const pkg=JSON.parse(read('package.json'));
function pass(label,ok){if(!ok)throw new Error(`FAIL U70: ${label}`);console.log(`PASS U70: ${label}`)}
pass('map rebuild version continuity',fs.existsSync(path.join(root,'U70_VERSION.txt'))&&(/u70|u71/i.test(pkg.version)));
pass('single Leaflet preferCanvas option',!risk.includes('preferCanvas:true,preferCanvas:true')&&risk.includes('preferCanvas:true'));
pass('India map bounds',risk.includes('maxBounds:INDIA_BOUNDS')&&risk.includes('maxBoundsViscosity'));
pass('stable map resize',risk.includes('invalidateSize')&&risk.includes('resize'));
pass('exact vs approximate provenance',risk.includes('DISTRICT_CENTROID')&&risk.includes('GEOCODED_PLACE')&&risk.includes('PROJECT POINT'));
pass('sidebar and marker share locationMeta',risk.includes('locationMeta(p)')&&risk.includes('m.short'));
pass('project focus',risk.includes('const focus=(p)')&&risk.includes('flyTo'));
pass('India-only geocoder',risk.includes('/api/geocode/search')&&risk.includes('country'));
pass('safe unresolved handling',risk.includes('UNRESOLVED')&&risk.includes('Search India location'));
pass('responsive map grid',risk.includes('grid-template-columns:minmax(0,1fr)')&&risk.includes('@media(max-width:1050px)'));
pass('expanded district fallback data',loc.includes('Krishnagiri')&&loc.includes('Gopalganj')&&loc.includes('Bengaluru Rural')&&loc.includes('Malda')&&loc.includes('Indore'));
pass('local demo fallback is environment controlled',db.includes('BHOOMI_LOCAL_DEMO_LOCATION_FALLBACK'));
pass('credential repair synchronises env',repair.includes('syncEnv')&&repair.includes('BHOOMI_GOV_PASSWORD')&&repair.includes('BHOOMI_LOCAL_DEMO_LOCATION_FALLBACK'));
console.log('NATIONAL MAP FUNCTIONAL REBUILD SMOKE PASSED');

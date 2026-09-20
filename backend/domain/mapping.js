import crypto from 'node:crypto';
import { coordinatePairValid } from './map-location-data.js';

export const GEOCODER_PROVIDER = 'nominatim-openstreetmap';
export const GEOCODER_VERSION = 'geocoder-proxy-v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let lastRemoteCallAt = 0;
let inflight = Promise.resolve();

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const normalise=(v)=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
const cacheKey=(q)=>crypto.createHash('sha256').update(normalise(q)).digest('hex');

function sanitiseResult(r){
  const lat=Number(r?.lat), lon=Number(r?.lon);
  if(!coordinatePairValid(lat,lon)) return null;
  const address=r?.address && typeof r.address==='object' ? {
    city:r.address.city || r.address.town || r.address.village || r.address.municipality || null,
    district:r.address.state_district || r.address.district || null,
    state:r.address.state || null,
    country:r.address.country || null,
    postcode:r.address.postcode || null,
  } : {};
  return {lat,lon,displayName:String(r?.display_name||'').slice(0,500),type:r?.type||null,class:r?.class||null,
    osmType:r?.osm_type||null,osmId:r?.osm_id??null,boundingBox:Array.isArray(r?.boundingbox)?r.boundingbox.map(Number):null,address};
}

export function buildLocationFromProject(project){
  if(project?.geometryGeoJSON) return {precision:'PARCEL_GEOMETRY',source:project?.source?.label||'PROJECT_GEOMETRY',label:'Project geometry supplied by source record'};
  if(coordinatePairValid(project?.latitude,project?.longitude)) return {
    precision:project?.locationPrecision||'PROJECT_POINT', source:project?.locationSource||'PROJECT_POINT',
    label:project?.locationLabel||'Project coordinate supplied in project record'
  };
  return {precision:'UNRESOLVED',source:null,label:'No project-level coordinate or parcel geometry is available.'};
}

export async function searchGeocoder(query,{fetchImpl=globalThis.fetch}={}){
  const q=String(query||'').trim();
  if(!q) throw new Error('Location search text is required.');
  if(q.length>240) throw new Error('Location search is limited to 240 characters.');
  const url=new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q',`${q}${/india\s*$/i.test(q)?'':', India'}`);
  url.searchParams.set('format','jsonv2');
  url.searchParams.set('addressdetails','1');
  url.searchParams.set('limit','5');
  url.searchParams.set('countrycodes','in');
  // Deliberate, user-triggered search only. Not autocomplete.
  const task=async()=>{
    const wait=Math.max(0,1000-(Date.now()-lastRemoteCallAt));
    if(wait) await sleep(wait);
    lastRemoteCallAt=Date.now();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetchImpl(url,{headers:{'User-Agent':'BHOOMIDHRISHTI-Precise-Mapping/1.0','Accept':'application/json','Accept-Language':'en'},signal:controller.signal});
      if(!response.ok) throw new Error(`Geocoder returned HTTP ${response.status}.`);
      const body=await response.json();
      return Array.isArray(body)?body.map(sanitiseResult).filter(Boolean):[];
    } finally { clearTimeout(timer); }
  };
  // Serialize external calls so the public service is never hit concurrently.
  const result=inflight.then(task,task);
  inflight=result.catch(()=>{});
  return result;
}

export function makeCacheRecord(query,results,nowMs=Date.now()){
  return {queryKey:cacheKey(query),queryText:String(query),results, fetchedAt:new Date(nowMs).toISOString(),expiresAt:new Date(nowMs+CACHE_TTL_MS).toISOString()};
}

export const mappingCacheKey=cacheKey;

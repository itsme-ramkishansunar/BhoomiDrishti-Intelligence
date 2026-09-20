import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { AlertTriangle, CheckCircle2, Crosshair, Layers3, LocateFixed, Loader2, MapPin, Maximize2, RefreshCw, Search, Trash2, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const INDIA_BOUNDS = [[6.0, 68.0], [38.5, 98.5]];
const INDIA_CENTER = [22.8, 79.2];
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const C = {
  surface:'#FFFFFF', surfaceSunk:'#F2F4EF', border:'#D9DED5', ink:'#182019', inkSoft:'#586158', inkFaint:'#7C857A',
  primary:'#2F5C48', primaryDark:'#1E3E30', high:'#B52D24', med:'#9A650A', low:'#23734B', blue:'#315F8A'
};
const bandColor = band => band === 'high' ? C.high : band === 'medium' ? C.med : C.low;
const bandLabel = band => band === 'high' ? 'High risk' : band === 'medium' ? 'Medium risk' : 'Low risk';

function validPoint(p) {
  const lat=Number(p?.latitude), lon=Number(p?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=6&&lat<=38.5&&lon>=68&&lon<=98.5;
}
function locationMeta(p) {
  if (p?.geometryGeoJSON) return {kind:'geometry',label:'Parcel / source geometry',short:'PARCEL GEOMETRY',approx:false,exact:true};
  if (!validPoint(p)) return {kind:'unresolved',label:'No stored location',short:'UNRESOLVED',approx:false,exact:false};
  const precision=String(p.locationPrecision||'PROJECT_POINT').toUpperCase();
  const authority=String(p.locationAuthority||'').toUpperCase();
  const approx=precision==='DISTRICT_CENTROID'||precision==='GEOCODED_PLACE'||authority==='DEMO_APPROXIMATE'||authority==='OPEN_MAP_GEOCODE';
  if (approx) return {kind:'approx',label:p.locationLabel||'Approximate location — not parcel geometry',short:precision.replaceAll('_',' '),approx:true,exact:false};
  return {kind:'exact',label:p.locationLabel||'Project coordinate supplied by project record',short:'PROJECT POINT',approx:false,exact:true};
}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function markerIcon(project, selected=false){
  const meta=locationMeta(project), color=bandColor(project.risk.band), size=selected?24:17;
  const border=meta.approx?'3px dashed #fff':'3px solid #fff';
  const opacity=meta.approx?.78:1;
  return L.divIcon({className:'bhoomi-risk-marker',html:`<div title="${escapeHtml(meta.label)}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${opacity};border:${border};box-shadow:0 1px 8px rgba(0,0,0,.30),0 0 0 3px ${color}24"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2],popupAnchor:[0,-size/2]});
}
function clusterIcon(count){return L.divIcon({className:'bhoomi-cluster',html:`<div style="width:38px;height:38px;border-radius:50%;background:${C.primary};border:3px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.28);color:#fff;display:flex;align-items:center;justify-content:center;font:800 12px ${FONT_BODY}">${count}</div>`,iconSize:[38,38],iconAnchor:[19,19]});}
function geometryLayer(project){
  const color=bandColor(project.risk.band);
  try{return L.geoJSON(project.geometryGeoJSON,{style:{color,weight:2.5,fillColor:color,fillOpacity:.12},pointToLayer:(_,latlng)=>L.circleMarker(latlng,{radius:7,color,fillColor:color,fillOpacity:.88,weight:2})});}catch{return null;}
}
function popupHtml(project){
  const m=locationMeta(project), r=project.risk;
  return `<div style="min-width:260px;font-family:${FONT_BODY}">
    <div style="font-size:13px;font-weight:800;color:${C.ink};margin-bottom:4px">${escapeHtml(project.name)}</div>
    <div style="font-size:10.5px;color:${C.inkSoft};margin-bottom:8px">${escapeHtml(project.code)} · ${escapeHtml(project.district)}, ${escapeHtml(project.state)}</div>
    <div style="font-size:12px;font-weight:800;color:${bandColor(r.band)};margin-bottom:7px">${r.overall}/100 · ${bandLabel(r.band)}</div>
    <div style="font-size:10.5px;color:${C.inkSoft};padding:7px 0;border-top:1px solid ${C.border}"><b>${escapeHtml(m.short)}</b><br/>${escapeHtml(m.label)}</div>
    <button data-project="${escapeHtml(project.id)}" style="border:0;background:${C.primary};color:#fff;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;width:100%">Open project dossier</button>
  </div>`;
}

export default function RiskMap({ scored=[], openProject, onRefresh, onArchiveProject, canManageProjects=false, lastUpdated, focusProjectId=null }) {
  const mapNode=useRef(null), mapRef=useRef(null), layersRef=useRef(new Map()), initialFitRef=useRef(false), dataSignatureRef=useRef(''), tileFallbackRef=useRef(false), focusedProjectRef=useRef(null);
  const [stateFilter,setStateFilter]=useState('all'),[riskFilter,setRiskFilter]=useState('all'),[typeFilter,setTypeFilter]=useState('all');
  const [query,setQuery]=useState(''),[tileStatus,setTileStatus]=useState('loading'),[showRiskZones,setShowRiskZones]=useState(true),[showApproximate,setShowApproximate]=useState(true),[showOpenOnly,setShowOpenOnly]=useState(false),[mapReady,setMapReady]=useState(false),[selectedId,setSelectedId]=useState(null),[refreshing,setRefreshing]=useState(false),[locatingId,setLocatingId]=useState(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[legendOpen,setLegendOpen]=useState(false);
  const states=useMemo(()=>['all',...Array.from(new Set(scored.map(p=>p.state).filter(Boolean))).sort()],[scored]);
  const types=useMemo(()=>['all',...Array.from(new Set(scored.map(p=>p.type).filter(Boolean))).sort()],[scored]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return scored.filter(p=>(stateFilter==='all'||p.state===stateFilter)&&(riskFilter==='all'||p.risk.band===riskFilter)&&(typeFilter==='all'||p.type===typeFilter)&&(!showOpenOnly||p.status==='ongoing')&&(!q||`${p.name} ${p.code} ${p.district} ${p.state}`.toLowerCase().includes(q)));},[scored,stateFilter,riskFilter,typeFilter,showOpenOnly,query]);
  const exact=useMemo(()=>filtered.filter(p=>locationMeta(p).exact),[filtered]);
  const approximate=useMemo(()=>filtered.filter(p=>locationMeta(p).approx),[filtered]);
  const unresolved=useMemo(()=>filtered.filter(p=>locationMeta(p).kind==='unresolved'),[filtered]);
  const drawable=useMemo(()=>filtered.filter(p=>(validPoint(p)||p.geometryGeoJSON)&& (showApproximate||!locationMeta(p).approx)),[filtered,showApproximate]);

  useEffect(()=>{
    if(!mapNode.current||mapRef.current)return;
    const map=L.map(mapNode.current,{center:INDIA_CENTER,zoom:5,minZoom:4,maxZoom:18,zoomControl:false,preferCanvas:true,worldCopyJump:false,maxBounds:INDIA_BOUNDS,maxBoundsViscosity:.85});
    L.control.zoom({position:'topright'}).addTo(map);
    const primaryTiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors',crossOrigin:true,updateWhenIdle:true,keepBuffer:2});
    let tileErrors=0;
    const fallbackTiles=()=>{
      if(tileFallbackRef.current || !mapRef.current) return;
      tileFallbackRef.current=true;
      try { primaryTiles.remove(); } catch {}
      const fallback=L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; OSM France',subdomains:'abc',updateWhenIdle:true,keepBuffer:2});
      fallback.on('tileload',()=>setTileStatus('online')); fallback.on('tileerror',()=>setTileStatus('degraded')); fallback.addTo(map);
    };
    primaryTiles.on('tileload',()=>setTileStatus('online'));
    primaryTiles.on('tileerror',()=>{tileErrors+=1; setTileStatus('degraded'); if(tileErrors>=4) fallbackTiles();});
    primaryTiles.addTo(map);
    map.on('click',()=>setSelectedId(null));
    mapRef.current=map;setMapReady(true);
    const resize=()=>map.invalidateSize({pan:false});
    const timers=[80,300,800,1500].map(ms=>setTimeout(resize,ms));map.whenReady(resize);window.addEventListener('resize',resize);
    return()=>{timers.forEach(clearTimeout);window.removeEventListener('resize',resize);map.remove();mapRef.current=null;setMapReady(false);};
  },[]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    map.invalidateSize({pan:false});layersRef.current.forEach(layer=>layer.remove());layersRef.current.clear();
    const bounds=[];
    const groups=new Map();
    drawable.filter(p=>!p.geometryGeoJSON&&validPoint(p)).forEach(p=>{const key=`${Number(p.latitude).toFixed(5)},${Number(p.longitude).toFixed(5)}`;const a=groups.get(key)||[];a.push(p);groups.set(key,a);});
    groups.forEach(group=>{
      const lat=Number(group[0].latitude),lon=Number(group[0].longitude);bounds.push([lat,lon]);
      if(group.length>1){
        const marker=L.marker([lat,lon],{icon:clusterIcon(group.length),keyboard:true});
        marker.bindPopup(`<div style="min-width:270px;font-family:${FONT_BODY}"><div style="font-weight:800;font-size:13px;margin-bottom:7px">${group.length} projects at this location</div>${group.map(p=>`<div style="border-top:1px solid ${C.border};padding:7px 0"><b>${escapeHtml(p.name)}</b><div style="font-size:10px;color:${bandColor(p.risk.band)};margin:2px 0">${p.risk.overall}/100</div><button data-project="${escapeHtml(p.id)}" style="border:1px solid ${C.primary};background:#fff;color:${C.primary};border-radius:4px;padding:4px 7px;font-size:10px;font-weight:800">Open</button></div>`).join('')}</div>`);
        marker.on('popupopen',e=>e.popup.getElement()?.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>openProject?.(b.dataset.project))));
        marker.addTo(map);layersRef.current.set(`group:${lat},${lon}`,marker);group.forEach(p=>layersRef.current.set(p.id,marker));
      }else{
        const p=group[0],marker=L.marker([lat,lon],{icon:markerIcon(p,p.id===selectedId),keyboard:true,title:p.name});
        marker.bindPopup(popupHtml(p));marker.on('click',()=>setSelectedId(p.id));marker.on('popupopen',e=>{const b=e.popup.getElement()?.querySelector('[data-project]');if(b)b.onclick=()=>openProject?.(p.id);});marker.addTo(map);layersRef.current.set(p.id,marker);
        if(showRiskZones&&!locationMeta(p).approx&&p.risk.band!=='low'){const circle=L.circle([lat,lon],{radius:Math.max(4000,p.risk.overall*220),color:bandColor(p.risk.band),weight:1,fillOpacity:.08,interactive:false});circle.addTo(map);layersRef.current.set(`${p.id}:risk`,circle);}
      }
    });
    drawable.filter(p=>p.geometryGeoJSON).forEach(p=>{const layer=geometryLayer(p);if(!layer)return;layer.bindPopup(popupHtml(p));layer.on('click',()=>setSelectedId(p.id));layer.addTo(map);layersRef.current.set(`${p.id}:geometry`,layer);const b=layer.getBounds?.();if(b?.isValid())bounds.push([b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]);});
    const signature=drawable.map(p=>`${p.id}:${p.latitude||''}:${p.longitude||''}:${p.locationPrecision||''}:${p.geometryGeoJSON?'g':''}`).sort().join('|');
    const hadSignature=dataSignatureRef.current;
    const hadNewData=!hadSignature || (signature && signature!==hadSignature && drawable.some(p=>!hadSignature.includes(`${p.id}:`)));
    if(bounds.length && (!initialFitRef.current || hadNewData)){
      map.fitBounds(bounds,{padding:[35,35],maxZoom:5});
      initialFitRef.current=true;
    }
    dataSignatureRef.current=signature;
  },[drawable,selectedId,showRiskZones,mapReady,openProject]);

  const fitIndia=()=>mapRef.current?.fitBounds(INDIA_BOUNDS,{padding:[22,22],maxZoom:5});
  const fitData=()=>{
    const map=mapRef.current;if(!map)return;const pts=[];
    drawable.forEach(p=>{if(p.geometryGeoJSON){const g=layersRef.current.get(`${p.id}:geometry`);const b=g?.getBounds?.();if(b?.isValid())pts.push([b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]);}else if(validPoint(p))pts.push([Number(p.latitude),Number(p.longitude)]);});
    if(pts.length)map.fitBounds(pts,{padding:[28,28],maxZoom:7});else fitIndia();
  };
  const focus=(p)=>{
    setSelectedId(p.id);const map=mapRef.current;if(!map)return;
    if(p.geometryGeoJSON){const g=layersRef.current.get(`${p.id}:geometry`);const b=g?.getBounds?.();if(b?.isValid())map.fitBounds(b,{padding:[50,50],maxZoom:14});g?.openPopup?.();return;}
    if(validPoint(p)){map.flyTo([Number(p.latitude),Number(p.longitude)],locationMeta(p).approx?11:14,{duration:.45});layersRef.current.get(p.id)?.openPopup?.();}
  };
  const refresh=async()=>{if(!onRefresh||refreshing)return;setRefreshing(true);setError('');try{await onRefresh();setMessage('Project and risk data refreshed.');}catch(e){setError(e?.message||'Refresh failed.');}finally{setRefreshing(false);}};
  useEffect(()=>{ if(!focusProjectId||!mapReady||focusedProjectRef.current===String(focusProjectId)) return; const project=filtered.find(p=>String(p.id)===String(focusProjectId))||scored.find(p=>String(p.id)===String(focusProjectId)); if(!project) return; focusedProjectRef.current=String(focusProjectId); focus(project); setMessage(`Focused ${project.name} on the GIS map.`); },[focusProjectId,mapReady,filtered,scored]);
  const resolveLocation=async(p)=>{
    setLocatingId(p.id);setError('');setMessage(`Searching an India-only place result for ${p.name}…`);
    try{
      const queries=[`${p.name}, ${p.district}, ${p.state}, India`,`${p.district}, ${p.state}, India`];let result=null;
      for(const q of queries){const r=await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`,{credentials:'include',headers:{Accept:'application/json'}});const j=await r.json().catch(()=>({}));if(r.ok&&j.results?.length){result=j.results.find(x=>String(x?.address?.country||'').toLowerCase()==='india')||j.results[0];if(result)break;}}
      if(!result)throw new Error('No defensible India place result was returned. The project stays unresolved.');
      const save=await fetch(`/api/projects/${encodeURIComponent(p.id)}/location`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({latitude:Number(result.lat),longitude:Number(result.lon),locationPrecision:'GEOCODED_PLACE',locationSource:'NOMINATIM_OSM',locationLabel:`${result.displayName||`${p.district}, ${p.state}`} · place-level geocode; not parcel geometry`,locationOsmType:result.osmType||null,locationOsmId:result.osmId??null,locationBBox:result.boundingBox||null})});
      const j=await save.json().catch(()=>({}));if(!save.ok)throw new Error(j.error||`Location update failed (${save.status}).`);
      setMessage(`${p.name} mapped to a place-level OpenStreetMap result. It is explicitly approximate until an authorised project/parcel coordinate is supplied.`);await onRefresh?.();return true;
    }catch(e){setError(e?.message||'Location search failed safely.');setMessage('');return false;}finally{setLocatingId(null);}
  };
  const resolveMissing=async()=>{if(!unresolved.length){setMessage('No unresolved projects in the current filter.');return;}let ok=0;const attempted=Math.min(unresolved.length,8);for(const p of unresolved.slice(0,8)){if(await resolveLocation(p)) ok++;}setMessage(`Location resolution completed: ${ok}/${attempted} projects mapped. Any remaining records stay unresolved rather than receiving invented coordinates.`);};

  return <div className="flex flex-col gap-3" style={{minWidth:0}}>
    <div className="flex flex-wrap items-end justify-between gap-3" style={{minWidth:0}}>
      <div style={{minWidth:0}}><div style={{fontFamily:FONT_BODY,fontSize:12,color:C.inkFaint}}>Operational GIS intelligence · SIH26017</div><h2 style={{fontFamily:"'Source Serif 4',Georgia,serif",fontSize:23,fontWeight:650,color:C.ink}}>National project risk map</h2><div style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint}}>India-bounded Leaflet map. Stored project coordinates and source geometry are distinguished from place-level / district approximations.</div></div>
      <div className="flex flex-wrap items-center gap-2">
        <span style={{width:8,height:8,borderRadius:99,background:tileStatus==='online'?C.low:tileStatus==='degraded'?C.med:C.inkFaint}}/><span style={{fontFamily:FONT_BODY,fontSize:11,color:C.inkSoft}}>{tileStatus==='online'?'LIVE MAP':tileStatus==='degraded'?'MAP DEGRADED':'LOADING MAP'}</span>
        <button onClick={fitIndia} disabled={!mapReady} className="bd-map-btn"><Maximize2 size={12}/> India</button><button onClick={fitData} disabled={!mapReady} className="bd-map-btn"><Crosshair size={12}/> Fit data</button><button onClick={refresh} disabled={!onRefresh||refreshing} className="bd-map-btn">{refreshing?<RefreshCw size={12} className="animate-spin"/>:<RefreshCw size={12}/>} Refresh</button>{unresolved.length>0&&<button onClick={resolveMissing} disabled={!!locatingId} className="bd-map-btn">{locatingId?<Loader2 size={12} className="animate-spin"/>:<LocateFixed size={12}/>} Resolve missing</button>}
      </div>
    </div>
    {(message||error)&&<div className="flex items-start justify-between gap-2 rounded-md px-3 py-2" style={{background:error?'#F9E9E6':'#E9F3EC',border:`1px solid ${error?'#D98B83':'#B8D7C1'}`,color:error?C.high:C.primary,fontFamily:FONT_BODY,fontSize:11}}><span className="flex items-center gap-2">{error?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>} {error||message}</span><button onClick={()=>{setError('');setMessage('')}} style={{border:0,background:'transparent',color:'inherit'}}><X size={13}/></button></div>}
    <div className="bd-map-grid">
      <section className="rounded-md overflow-hidden" style={{background:C.surface,border:`1px solid ${C.border}`,minWidth:0}}>
        <div className="flex flex-wrap items-center gap-2 p-3" style={{borderBottom:`1px solid ${C.border}`}}>
          <select value={stateFilter} onChange={e=>setStateFilter(e.target.value)} className="bd-map-input"><option value="all">All states</option>{states.filter(x=>x!=='all').map(x=><option key={x}>{x}</option>)}</select>
          <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} className="bd-map-input"><option value="all">All risk levels</option><option value="high">High risk</option><option value="medium">Medium risk</option><option value="low">Low risk</option></select>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="bd-map-input"><option value="all">All project types</option>{types.filter(x=>x!=='all').map(x=><option key={x}>{x}</option>)}</select>
          <div className="relative" style={{flex:'1 1 220px',minWidth:180}}><Search size={14} style={{position:'absolute',left:9,top:8,color:C.inkFaint}}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search project, district or code" className="bd-map-input" style={{width:'100%',paddingLeft:29}}/></div>
          <label className="bd-map-check"><input type="checkbox" checked={showRiskZones} onChange={e=>setShowRiskZones(e.target.checked)}/> risk zones</label><label className="bd-map-check"><input type="checkbox" checked={showApproximate} onChange={e=>setShowApproximate(e.target.checked)}/> approximate</label><label className="bd-map-check"><input type="checkbox" checked={showOpenOnly} onChange={e=>setShowOpenOnly(e.target.checked)}/> ongoing</label><button onClick={()=>setLegendOpen(v=>!v)} className="bd-map-btn"><Layers3 size={12}/> Legend</button>
        </div>
        {legendOpen&&<div className="flex flex-wrap gap-3 px-3 py-2" style={{borderBottom:`1px solid ${C.border}`,fontFamily:FONT_BODY,fontSize:10.5,color:C.inkSoft}}><span><b style={{color:C.primary}}>●</b> Project point</span><span><b style={{color:C.med}}>◌</b> Approximate</span><span><b style={{color:C.high}}>●</b> High risk</span><span>Geometry = source parcel shape</span><span>Unresolved = never plotted</span></div>}
        <div ref={mapNode} style={{height:'clamp(480px,62vh,680px)',width:'100%',background:'#E6EEF0'}}/>
        <div className="px-3 py-2" style={{borderTop:`1px solid ${C.border}`,fontFamily:FONT_BODY,fontSize:10.3,color:C.inkFaint}}><b style={{color:C.ink}}>{drawable.length}</b> plotted · <b style={{color:C.primary}}>{exact.length}</b> project/source locations · <b style={{color:C.med}}>{approximate.length}</b> approximate · <b style={{color:C.high}}>{unresolved.length}</b> unresolved · {filtered.length} in filter{lastUpdated?` · refreshed ${new Date(lastUpdated).toLocaleTimeString()}`:''}</div>
      </section>
      <aside className="rounded-md overflow-hidden" style={{background:C.surface,border:`1px solid ${C.border}`,minWidth:0}}>
        <div className="p-3" style={{borderBottom:`1px solid ${C.border}`}}><div style={{fontFamily:FONT_BODY,fontSize:11,color:C.inkFaint}}>Portfolio index</div><div style={{fontFamily:"'Source Serif 4',Georgia,serif",fontSize:22,fontWeight:650,color:C.ink}}>{filtered.length} projects</div><div style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint,marginTop:2}}>{exact.length} project/source · {approximate.length} approximate · {unresolved.length} unresolved</div></div>
        <div style={{maxHeight:'clamp(480px,62vh,680px)',overflowY:'auto',overflowX:'hidden'}}>{filtered.map(p=>{const m=locationMeta(p);return <div key={p.id} style={{padding:'11px 12px',borderBottom:`1px solid ${C.border}`,background:selectedId===p.id?C.surfaceSunk:C.surface}}><button onClick={()=>focus(p)} style={{width:'100%',textAlign:'left',border:0,background:'transparent',padding:0,cursor:'pointer'}}><div className="flex items-start justify-between gap-2"><span style={{fontFamily:FONT_BODY,fontSize:12.5,fontWeight:800,color:C.ink,lineHeight:1.25}}>{p.name}</span><span style={{color:bandColor(p.risk.band),fontWeight:900,fontSize:11.5,flex:'0 0 auto'}}>{p.risk.overall}</span></div><div style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint,marginTop:3}}>{p.district}, {p.state} · {p.type}</div><div className="flex items-center gap-1 mt-1" style={{fontFamily:FONT_BODY,fontSize:10,color:m.exact?C.primary:m.approx?C.med:C.high}}>{m.exact?<MapPin size={11}/>:<AlertTriangle size={11}/>} {m.short}</div></button>{m.approx&&<div style={{fontFamily:FONT_BODY,fontSize:9.5,color:C.inkFaint,marginTop:3}}>Approximate only · not parcel geometry</div>}{m.kind==='unresolved'&&<button onClick={()=>resolveLocation(p)} disabled={!!locatingId} className="bd-map-locate">{locatingId===p.id?<Loader2 size={11} className="animate-spin"/>:<LocateFixed size={11}/>} Search India location</button>}{canManageProjects&&<button onClick={()=>onArchiveProject?.(p)} className="bd-map-remove"><Trash2 size={11}/> Remove project</button>}</div>})}</div>
      </aside>
    </div>
    <style>{`.bd-map-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,320px);gap:12px;min-width:0}.bd-map-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid ${C.border};background:${C.surface};color:${C.primary};border-radius:6px;padding:7px 9px;font-family:${FONT_BODY};font-size:10.8px;font-weight:800;cursor:pointer;white-space:nowrap}.bd-map-btn:disabled{opacity:.45;cursor:not-allowed}.bd-map-input{box-sizing:border-box;font-family:${FONT_BODY};font-size:11px;color:${C.ink};background:${C.surface};border:1px solid ${C.border};border-radius:6px;padding:7px 9px}.bd-map-check{display:inline-flex;align-items:center;gap:5px;font-family:${FONT_BODY};font-size:10.8px;color:${C.inkSoft};white-space:nowrap}.bd-map-remove{display:inline-flex;align-items:center;gap:5px;margin-top:7px;margin-left:5px;border:1px solid #B52D2444;background:#F9E9E6;color:#B52D24;border-radius:5px;padding:5px 8px;font-family:${FONT_BODY};font-size:10px;font-weight:800;cursor:pointer}.bd-map-locate{display:inline-flex;align-items:center;gap:5px;margin-top:7px;border:1px solid ${C.border};background:${C.surfaceSunk};color:${C.primary};border-radius:5px;padding:5px 8px;font-family:${FONT_BODY};font-size:10px;font-weight:800;cursor:pointer}.leaflet-container{font-family:${FONT_BODY};z-index:0}.leaflet-control-zoom a{font-weight:800}@media(max-width:1050px){.bd-map-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
  </div>;
}

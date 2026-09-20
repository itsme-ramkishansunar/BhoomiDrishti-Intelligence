import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Play, Clock3, ShieldCheck, Activity, History } from 'lucide-react';

const C = {
  surface:'#fff', border:'#DBDFD4', ink:'#1B231C', inkSoft:'#586055', faint:'#8A9184',
  primary:'#2F5C48', tint:'#E4EDE6', high:'#AC2B22', highTint:'#F8E6E3', med:'#95600A', medTint:'#F7EDD9'
};
const FONT = "'IBM Plex Sans','Inter',system-ui,sans-serif";
function Card({children,style={}}){return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,...style}}>{children}</div>}
function Btn({children,onClick,disabled=false,icon:Icon}){return <button onClick={disabled?undefined:onClick} disabled={disabled} style={{display:'inline-flex',alignItems:'center',gap:7,border:0,borderRadius:7,padding:'8px 12px',background:disabled?'#9aa19a':C.primary,color:'#fff',fontFamily:FONT,fontSize:12.5,fontWeight:600,cursor:disabled?'default':'pointer'}}>{Icon&&<Icon size={14}/>} {children}</button>}

export default function OperationsCenterPage({scored=[]}) {
  const [overview,setOverview]=useState(null); const [alerts,setAlerts]=useState([]); const [monitoring,setMonitoring]=useState(null); const [actionIntel,setActionIntel]=useState([]); const [timeline,setTimeline]=useState(null); const [loading,setLoading]=useState(true); const [message,setMessage]=useState('');
  const refresh=async()=>{setLoading(true);setMessage('');try{const [o,a,m]=await Promise.all([
    fetch('/api/operations/overview',{credentials:'include'}),
    fetch('/api/alerts?status=all&limit=100',{credentials:'include'}),
    fetch('/api/ml/monitoring',{credentials:'include'})]);
    const [x,t]=await Promise.all([
      fetch('/api/operations/action-intelligence',{credentials:'include'}).then(r=>r.json()),
      fetch('/api/operations/statutory-timeline',{credentials:'include'}).then(r=>r.json())
    ]);
    const [oj,aj,mj,xj,tj]=await Promise.all([o.json(),a.json(),m.json(),Promise.resolve(x),Promise.resolve(t)]);
    if(!o.ok) throw new Error(oj.error||'Unable to load operational overview.');
    setOverview(oj); setAlerts(Array.isArray(aj.alerts)?aj.alerts:[]); setMonitoring(mj);
    setActionIntel(Array.isArray(xj.candidates)?xj.candidates:[]);
    setTimeline(tj||null);
  }catch(e){setMessage(e?.message||'Operational data unavailable.');}finally{setLoading(false);}};
  useEffect(()=>{refresh();},[]);
  const generate=async()=>{try{const r=await fetch('/api/alerts/generate',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Alert generation failed.');setMessage(`${j.count||0} operational alerts generated/updated.`);await refresh();}catch(e){setMessage(e?.message||'Alert generation failed.');}};
  const generateActions=async()=>{try{const r=await fetch('/api/operations/action-intelligence/generate',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Action generation failed.');setMessage(`${j.generatedCount||0} governed recommendations generated; ${j.skippedCount||0} duplicates skipped.`);await refresh();}catch(e){setMessage(e?.message||'Action generation failed.');}};
  const updateAlert=async(id,status)=>{try{const r=await fetch(`/api/alerts/${encodeURIComponent(id)}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Alert update failed.');setAlerts((cur)=>cur.map(x=>x.id===id?j.alert:x));}catch(e){setMessage(e?.message||'Alert update failed.');}};
  const projectsById=useMemo(()=>new Map(scored.map(p=>[String(p.id),p])),[scored]);
  const topWarnings=overview?.warnings||[];
  return <div style={{fontFamily:FONT,display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
      <div><div style={{fontSize:11,color:C.faint,textTransform:'uppercase',letterSpacing:.7}}>Operational intelligence</div><h2 style={{margin:'3px 0 0',fontSize:24,color:C.ink}}>Early Warning & MLOps Center</h2><div style={{marginTop:3,fontSize:12.5,color:C.inkSoft}}>Risk → Why → Evidence → Time → Action → Outcome</div></div>
      <div style={{display:'flex',gap:8}}><Btn icon={Play} onClick={generate} disabled={loading}>Generate warnings</Btn><Btn icon={CheckCircle2} onClick={generateActions} disabled={loading}>Generate actions</Btn><Btn icon={RefreshCw} onClick={refresh} disabled={loading}>Refresh</Btn></div>
    </div>
    {message&&<Card style={{padding:'10px 12px',background:C.tint,color:C.primary,fontSize:12}}>{message}</Card>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>
      {[['Projects analysed',overview?.summary?.projectsAnalysed??'—'],['High / critical',overview?.summary?.highOrCritical??'—'],['Open alerts',overview?.summary?.openAlerts??'—'],['ML monitor',monitoring?.status||'—']].map(([k,v])=><Card key={k} style={{padding:14}}><div style={{fontSize:11,color:C.faint}}>{k}</div><div style={{marginTop:5,fontSize:20,fontWeight:700,color:C.ink}}>{v}</div></Card>)}
    </div>
    <Card style={{padding:16}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div><div style={{fontSize:11,color:C.faint,textTransform:'uppercase'}}>Rule-based early warnings</div><div style={{marginTop:3,fontSize:16,fontWeight:700,color:C.ink}}>Current operational pressure</div></div><div style={{fontSize:11,color:C.faint}}>Warning lead time: {overview?.trust?.warningLeadTime||'NOT_AVAILABLE'}</div></div>
      <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>{topWarnings.slice(0,10).map(w=><div key={w.projectId} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'11px 12px',display:'grid',gridTemplateColumns:'1.6fr .55fr 2fr',gap:12,alignItems:'center'}}><div><div style={{fontWeight:700,color:C.ink}}>{w.projectName}</div><div style={{fontSize:11,color:C.faint,marginTop:2}}>Primary signal: {w.primarySignal}</div></div><div><div style={{fontSize:11,color:C.faint}}>Attention</div><div style={{fontSize:18,fontWeight:700,color:w.severity==='critical'?C.high:w.severity==='high'?C.med:C.primary}}>{Math.round(w.attentionScore)}/100</div></div><div style={{fontSize:12,color:C.inkSoft}}>{w.nextAction}<div style={{marginTop:3,fontSize:10.5,color:C.faint}}>{w.disclaimer}</div></div></div>)}</div>
      {!topWarnings.length&&!loading&&<div style={{padding:18,textAlign:'center',color:C.faint,fontSize:12.5}}>No warning signals available.</div>}
    </Card>
    
    <div style={{display:'grid',gridTemplateColumns:'1.45fr 1fr',gap:14}}>
      <Card style={{padding:16}}>
        <div style={{fontSize:11,color:C.faint,textTransform:'uppercase'}}>Governed action intelligence</div>
        <div style={{marginTop:3,fontSize:16,fontWeight:700,color:C.ink}}>Evidence → Rule → Recommended action</div>
        <div style={{marginTop:4,fontSize:11,color:C.inkSoft}}>Deterministic workflow signals are separate from prediction and require officer verification.</div>
        <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
          {actionIntel.slice(0,10).map((a,i)=><div key={`${a.projectId}-${a.ruleCode}-${i}`} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',display:'grid',gridTemplateColumns:'1.2fr .5fr 2fr',gap:10,alignItems:'center'}}>
            <div><div style={{fontSize:11,fontWeight:700,color:C.ink}}>{a.projectName}</div><div style={{fontSize:10.5,color:C.faint,marginTop:2}}>{a.ruleCode} · owner: {a.ownerRole}</div></div>
            <div><div style={{fontSize:10,color:C.faint}}>Priority</div><b style={{fontSize:16,color:a.severity==='high'?C.high:a.severity==='medium'?C.med:C.primary}}>{a.priority}</b></div>
            <div style={{fontSize:11.5,color:C.inkSoft}}>{a.actionText}<div style={{fontSize:10,color:C.faint,marginTop:3}}>{(a.evidence||[]).join(' · ')}</div></div>
          </div>)}
          {!actionIntel.length&&<div style={{padding:16,textAlign:'center',fontSize:12,color:C.faint}}>No governed action candidates available.</div>}
        </div>
      </Card>
      <Card style={{padding:16}}>
        <div style={{fontSize:11,color:C.faint,textTransform:'uppercase'}}>Timeline intelligence</div>
        <div style={{marginTop:3,fontSize:16,fontWeight:700,color:C.ink}}>Configured stage clocks</div>
        <div style={{marginTop:12,display:'flex',justifyContent:'space-between',fontSize:12,color:C.inkSoft}}><span>Projects</span><b>{timeline?.count??'—'}</b></div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.inkSoft,marginTop:7}}><span>Configured</span><b>{timeline?.configured??'—'}</b></div>
        <div style={{marginTop:12,padding:10,borderRadius:8,background:C.medTint,color:C.med,fontSize:11}}>No statutory deadline is invented. A project is marked configured only when its stored stage clock contains a target and source.</div>
        {(timeline?.rows||[]).filter(x=>x.activeStage?.overdue).slice(0,6).map(x=><div key={x.projectId} style={{marginTop:8,padding:9,border:`1px solid ${C.border}`,borderRadius:7,fontSize:11.5}}><b>{x.jurisdiction?.state||'—'} · {x.activeStage?.stageName||'Stage'}</b><div style={{color:C.high,marginTop:2}}>Configured clock variance: +{x.activeStage?.varianceDays} days</div></div>)}
      </Card>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14}}>
      <Card style={{padding:16}}><div style={{fontSize:11,color:C.faint,textTransform:'uppercase'}}>Persistent alert lifecycle</div><div style={{marginTop:3,fontSize:16,fontWeight:700,color:C.ink}}>Generated operational alerts</div><div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>{alerts.slice(0,12).map(a=><div key={a.id} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><div style={{fontSize:11,fontWeight:700,color:a.severity==='critical'||a.severity==='high'?C.high:C.med,textTransform:'uppercase'}}>{a.severity} · {a.category}</div><div style={{marginTop:2,fontWeight:600,color:C.ink}}>{a.projectName}</div><div style={{marginTop:2,fontSize:12,color:C.inkSoft}}>{a.reason}</div></div><div style={{textAlign:'right',minWidth:120}}><div style={{fontSize:10.5,color:C.faint,textTransform:'capitalize'}}>{a.status}</div>{a.status!=='resolved'&&a.status!=='dismissed'&&<Btn onClick={()=>updateAlert(a.id,a.status==='open'?'acknowledged':'resolved')}>{a.status==='open'?'Acknowledge':'Resolve'}</Btn>}</div></div></div>)}</div></Card>
      <Card style={{padding:16}}><div style={{fontSize:11,color:C.faint,textTransform:'uppercase'}}>Trust / MLOps</div><div style={{marginTop:3,fontSize:16,fontWeight:700,color:C.ink}}>Model monitoring state</div><div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10}}><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.inkSoft,fontSize:12}}>Production promotion</span><b style={{color:monitoring?.productionPromotionAllowed?C.primary:C.high}}>{monitoring?.productionPromotionAllowed?'ALLOWED':'BLOCKED'}</b></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.inkSoft,fontSize:12}}>Latest drift status</span><b>{monitoring?.latestSnapshot?.driftStatus||'NOT_AVAILABLE'}</b></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.inkSoft,fontSize:12}}>Calibration</span><b>{monitoring?.latestSnapshot?.calibrationError==null?'NOT_AVAILABLE':monitoring.latestSnapshot.calibrationError}</b></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.inkSoft,fontSize:12}}>OOD rate</span><b>{monitoring?.latestSnapshot?.oodRate==null?'NOT_AVAILABLE':monitoring.latestSnapshot.oodRate}</b></div><div style={{marginTop:4,padding:10,borderRadius:8,background:C.medTint,color:C.med,fontSize:11.5}}>Trusted ML remains governed by the validation gates. Missing real data does not become a false production result.</div></div></Card>
    </div>
    <Card style={{padding:14,display:'flex',gap:8,alignItems:'center',color:C.inkSoft,fontSize:11.5}}><ShieldCheck size={15} color={C.primary}/><span>Warnings are rule-based operational signals here; calibrated prediction probability and warning lead time stay unavailable until validated data/model evidence exists.</span></Card>
  </div>;
}

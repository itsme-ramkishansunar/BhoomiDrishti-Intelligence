import React, { useEffect, useState } from 'react';
import { Activity, Clock3, Database, GitBranch, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

const C={surface:'#fff',surfaceSunk:'#EEF0EA',border:'#DBDFD4',ink:'#1B231C',inkSoft:'#586055',inkFaint:'#8A9184',primary:'#2F5C48',primaryTint:'#E4EDE6',gold:'#8A6A32',goldTint:'#F3ECDB',high:'#AC2B22',highTint:'#F8E6E3',med:'#95600A',medTint:'#F7EDD9',low:'#1E6B45',lowTint:'#E1F0E6'};
const FONT="'IBM Plex Sans','Inter',system-ui,sans-serif";

function Tag({children,color=C.primary,bg=C.primaryTint}){return <span style={{fontFamily:FONT,fontSize:10.5,fontWeight:700,color,background:bg,border:`1px solid ${color}33`,borderRadius:999,padding:'3px 7px'}}>{children}</span>}

export default function ProjectOpsPanel({project,user}){
  const [intel,setIntel]=useState(null);
  const [events,setEvents]=useState([]);
  const [evidence,setEvidence]=useState(null);
  const [workflow,setWorkflow]=useState(null); const [actionIntel,setActionIntel]=useState(null); const [timeline,setTimeline]=useState(null); const [scenarios,setScenarios]=useState([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const canAct=Array.isArray(user?.permissions)&&(user.permissions.includes('*')||user.permissions.includes('workflow:action'));

  useEffect(()=>{
    let cancelled=false; setBusy(true); setError('');
    Promise.all([
      fetch(`/api/projects/${project.id}/intelligence`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/timeline`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/evidence`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/workflow`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/action-intelligence`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/statutory-timeline`,{credentials:'include'}).then(r=>r.json()),
      fetch(`/api/projects/${project.id}/scenarios`,{credentials:'include'}).then(r=>r.json()),
    ]).then(([a,t,e,w,ai,tl,sc])=>{if(cancelled)return; setIntel(a?.intelligence||null);setEvents(Array.isArray(t?.events)?t.events:[]);setEvidence(e?.evidenceCards||null);setWorkflow(w?.workflow||null);setActionIntel(ai?.intelligence||null);setTimeline(tl?.timeline||null);setScenarios(Array.isArray(sc?.scenarios)?sc.scenarios:[]);}).catch(e=>!cancelled&&setError(e?.message||'Project intelligence is unavailable.')).finally(()=>!cancelled&&setBusy(false));
    return ()=>{cancelled=true};
  },[project.id]);

  if(busy) return <div className="rounded-md p-4 mt-4" style={{background:C.surface,border:`1px solid ${C.border}`,fontFamily:FONT,fontSize:12,color:C.inkFaint}}>Loading project intelligence…</div>;
  if(error) return <div className="rounded-md p-4 mt-4" style={{background:C.highTint,border:`1px solid ${C.high}33`,fontFamily:FONT,fontSize:12,color:C.high}}>{error}</div>;
  if(!intel) return null;

  const r=intel.possessionReadiness||{};
  return <div className="mt-4 flex flex-col gap-4">
    <div className="grid grid-cols-4 gap-3">
      <div className="rounded-md p-3" style={{background:C.surface,border:`1px solid ${C.border}`}}><div className="flex items-center gap-2" style={{fontFamily:FONT,fontSize:11,color:C.inkFaint}}><GitBranch size={13}/> Workflow applicability</div><div style={{fontFamily:FONT,fontSize:13,fontWeight:700,color:C.ink,marginTop:6}}>{intel.workflow?.code||'Unresolved'}</div><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:2}}>{intel.workflow?.act||'Authorised project configuration required'}</div></div>
      <div className="rounded-md p-3" style={{background:C.surface,border:`1px solid ${C.border}`}}><div className="flex items-center gap-2" style={{fontFamily:FONT,fontSize:11,color:C.inkFaint}}><Activity size={13}/> Bottleneck signal</div><div style={{fontFamily:FONT,fontSize:13,fontWeight:700,color:C.ink,marginTop:6}}>{intel.predictedBottleneck?.label||'Unavailable'}</div><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:2}}>{intel.predictedBottleneck?.score ?? '—'}/100 contribution signal</div></div>
      <div className="rounded-md p-3" style={{background:C.surface,border:`1px solid ${C.border}`}}><div className="flex items-center gap-2" style={{fontFamily:FONT,fontSize:11,color:C.inkFaint}}><Database size={13}/> Data reliability</div><div style={{fontFamily:FONT,fontSize:13,fontWeight:700,color:C.ink,marginTop:6}}>{intel.dataReliability?.completenessPct ?? '—'}% completeness</div><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:2}}>Source: {intel.dataReliability?.sourceLabel||'unspecified'}</div></div>
      <div className="rounded-md p-3" style={{background:C.surface,border:`1px solid ${C.border}`}}><div className="flex items-center gap-2" style={{fontFamily:FONT,fontSize:11,color:C.inkFaint}}><ShieldCheck size={13}/> Possession readiness</div><div style={{fontFamily:FONT,fontSize:13,fontWeight:700,color:r.status==='READY_REVIEW'?C.low:C.high,marginTop:6}}>{r.status||'UNKNOWN'}</div><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:2}}>{(r.blockers||[]).length} blocking dependencies</div></div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md p-4" style={{background:C.surface,border:`1px solid ${C.border}`}}>
        <div style={{fontFamily:FONT,fontSize:11,color:C.inkFaint,textTransform:'uppercase'}}>Governed action intelligence</div>
        <div style={{fontFamily:FONT,fontSize:15,fontWeight:700,color:C.ink,marginTop:3}}>Recommended actions</div>
        <div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:3}}>Rule-based workflow candidates; verify evidence before acting.</div>
        <div className="mt-3 flex flex-col gap-2">{(actionIntel?.candidates||[]).slice(0,5).map(c=><div key={c.ruleCode} className="rounded p-2" style={{border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT,fontSize:11.5,fontWeight:700,color:C.ink}}>{c.actionText}</div><div style={{fontFamily:FONT,fontSize:10,color:C.inkFaint,marginTop:2}}>{c.ruleCode} · {c.ownerRole} · priority {c.priority}</div></div>)}</div>
      </div>
      <div className="rounded-md p-4" style={{background:C.surface,border:`1px solid ${C.border}`}}>
        <div style={{fontFamily:FONT,fontSize:11,color:C.inkFaint,textTransform:'uppercase'}}>Timeline & scenarios</div>
        <div style={{fontFamily:FONT,fontSize:15,fontWeight:700,color:C.ink,marginTop:3}}>Configured stage clock</div>
        <div style={{fontFamily:FONT,fontSize:11,color:C.inkSoft,marginTop:5}}>{timeline?.configurationStatus||'NOT_CONFIGURED'} · {timeline?.activeStage?.stageName||'No active stage clock'}</div>
        {timeline?.activeStage?.varianceDays!=null&&<div style={{fontFamily:FONT,fontSize:11,color:timeline.activeStage.varianceDays>0?C.high:C.low,marginTop:4}}>{timeline.activeStage.varianceDays>0?`+${timeline.activeStage.varianceDays} days over configured target`:`${Math.abs(timeline.activeStage.varianceDays)} days within configured target`}</div>}
        <div style={{fontFamily:FONT,fontSize:10.5,color:C.inkFaint,marginTop:10}}>Saved hypothetical scenarios: {scenarios.length}</div>
        <div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:4}}>Scenarios never mutate project facts or become verified outcomes automatically.</div>
      </div>
    </div>

    <div className="rounded-md p-4" style={{background:C.surface,border:`1px solid ${C.border}`}}>
      <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Clock3 size={15} color={C.primary}/><div style={{fontFamily:FONT,fontSize:14,fontWeight:700,color:C.ink}}>Workflow & legal clock status</div></div><Tag color={workflow?.health?.status==='BREACHED'?C.high:workflow?.health?.status==='ACTIVE'?C.med:C.primary} bg={workflow?.health?.status==='BREACHED'?C.highTint:workflow?.health?.status==='ACTIVE'?C.medTint:C.primaryTint}>{workflow?.health?.status||'UNRESOLVED'}</Tag></div>
      {workflow?.workflowCode && workflow.workflowCode!=='UNRESOLVED' ? <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <div className="rounded px-3 py-2.5" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkFaint}}>Applicable framework</div><div style={{fontFamily:FONT,fontSize:12,fontWeight:700,color:C.ink,marginTop:3}}>{workflow.legalFramework||'Not recorded'}</div></div>
          <div className="rounded px-3 py-2.5" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkFaint}}>Current stage</div><div style={{fontFamily:FONT,fontSize:12,fontWeight:700,color:C.ink,marginTop:3}}>{workflow.currentStage?.label||'Not recorded'}</div></div>
          <div className="rounded px-3 py-2.5" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkFaint}}>Event coverage</div><div style={{fontFamily:FONT,fontSize:12,fontWeight:700,color:C.ink,marginTop:3}}>{workflow.eventCoverage?.coded ?? 0} coded / {workflow.eventCoverage?.total ?? 0} events</div></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">{(workflow.clocks||[]).map(clock=><div key={clock.code} className="rounded px-3 py-2.5" style={{background:clock.breached?C.highTint:C.surfaceSunk,border:`1px solid ${clock.breached?C.high:C.border}`}}><div className="flex items-start justify-between gap-2"><div style={{fontFamily:FONT,fontSize:11.5,fontWeight:700,color:C.ink}}>{clock.label}</div><Tag color={clock.breached?C.high:clock.status==='ACTIVE'?C.med:clock.status==='COMPLETED'?C.low:C.inkFaint} bg={clock.breached?C.highTint:clock.status==='ACTIVE'?C.medTint:clock.status==='COMPLETED'?C.lowTint:C.surfaceSunk}>{clock.status}</Tag></div>{clock.startAt && <div style={{fontFamily:FONT,fontSize:10.5,color:C.inkSoft,marginTop:6}}>Start: {new Date(clock.startAt).toLocaleDateString()} · Effective elapsed: {clock.effectiveElapsedDays ?? '—'}d</div>}{clock.deadlineAt && <div style={{fontFamily:FONT,fontSize:10.5,color:clock.breached?C.high:C.inkSoft,marginTop:2}}>{clock.breached?'Deadline breached':'Remaining'}: {clock.breached?'—':`${clock.remainingDays} days`} · {new Date(clock.deadlineAt).toLocaleDateString()}</div>}<div style={{fontFamily:FONT,fontSize:9.8,color:C.inkFaint,marginTop:6}}>{clock.sourceSection}</div></div>)}</div>
        {(workflow.dependencies||[]).length>0 && <div className="mt-3 pt-3" style={{borderTop:`1px solid ${C.border}`}}><div style={{fontFamily:FONT,fontSize:11.5,fontWeight:700,color:C.ink,marginBottom:7}}>Stage dependency graph</div><div className="flex flex-wrap gap-2">{workflow.dependencies.map(d=><div key={d.id} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`,fontFamily:FONT,fontSize:10.5,color:C.ink}}><b>{d.fromStageCode}</b><span style={{color:C.inkFaint}}>→</span><b>{d.toStageCode}</b><span style={{color:d.status==='blocked'?C.high:C.inkFaint}}>· {String(d.dependencyType).toUpperCase()}</span></div>)}</div></div>}
      </> : <div className="rounded px-3 py-2.5" style={{background:C.goldTint||'#F6EBD5',border:`1px solid ${C.gold}33`,fontFamily:FONT,fontSize:11,color:C.inkSoft}}><b>Workflow applicability not resolved.</b> An authorised administrator must confirm the acquisition framework before BhoomiDrishti presents statutory-clock conclusions.</div>}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="rounded-md p-4" style={{background:C.surface,border:`1px solid ${C.border}`}}>
        <div className="flex items-center gap-2 mb-3"><Clock3 size={15} color={C.primary}/><div style={{fontFamily:FONT,fontSize:14,fontWeight:700,color:C.ink}}>Project digital timeline</div></div>
        <div className="flex flex-col gap-2">{events.map((ev,i)=><div key={ev.id||i} className="flex items-start gap-3"><div style={{width:8,height:8,borderRadius:99,background:i===events.length-1?C.high:C.primary,marginTop:5}}/><div><div style={{fontFamily:FONT,fontSize:12,fontWeight:700,color:C.ink}}>{ev.label||ev.eventType}</div><div style={{fontFamily:FONT,fontSize:10.5,color:C.inkFaint}}>{new Date(ev.occurredAt).toLocaleString()} · {String(ev.sourceLabel||'unknown').toUpperCase()}</div></div></div>)}</div>
        <div className="mt-3 pt-3" style={{borderTop:`1px solid ${C.border}`,fontFamily:FONT,fontSize:10.5,color:C.inkFaint}}>Timeline events are separated from prediction timestamps; event time and ingestion time are distinct concepts.</div>
      </div>

      <div className="rounded-md p-4" style={{background:C.surface,border:`1px solid ${C.border}`}}>
        <div className="flex items-center gap-2 mb-3"><Database size={15} color={C.gold}/><div style={{fontFamily:FONT,fontSize:14,fontWeight:700,color:C.ink}}>Evidence graph snapshot</div></div>
        <div className="flex flex-col gap-2">{(evidence||[]).map((e)=><div key={e.id} className="rounded px-3 py-2.5" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`}}><div className="flex items-start justify-between gap-2"><div><div style={{fontFamily:FONT,fontSize:11.5,fontWeight:700,color:C.ink}}>{e.category}</div><div style={{fontFamily:FONT,fontSize:11,color:C.inkSoft,marginTop:2}}>{e.claim}</div></div><Tag color={e.provenance==='SYNTHETIC'?C.gold:C.primary} bg={e.provenance==='SYNTHETIC'?'#F6EBD5':C.primaryTint}>{e.provenance}</Tag></div><div style={{fontFamily:FONT,fontSize:10.3,color:C.inkFaint,marginTop:4}}>Source: {e.source}</div></div>)}</div>
      </div>
    </div>

    <div className="rounded-md px-3 py-2.5" style={{background:C.goldTint||'#F6EBD5',border:`1px solid ${C.gold}33`,fontFamily:FONT,fontSize:11,color:C.inkSoft}}><b>Decision boundary:</b> BhoomiDrishti identifies predictive and operational signals. It does not make legal determinations, change authoritative records, or replace the responsible government authority.</div>
  </div>;
}

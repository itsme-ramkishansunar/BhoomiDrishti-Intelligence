import React, { useState } from "react";
import { CheckCircle2, Send, Star } from "lucide-react";

const C = { surface:"#FFFFFF", border:"#DBDFD4", ink:"#1B231C", inkSoft:"#586055", inkFaint:"#8A9184", primary:"#2F5C48", tint:"#E4EDE6", high:"#AC2B22" };
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const categories=["Usability","Data & provenance","Risk intelligence","GIS / map","Workflow","AI / explanations","Other"];

export default function PublicReviewPage() {
  const [rating,setRating]=useState(0);
  const [category,setCategory]=useState("Usability");
  const [worked,setWorked]=useState("");
  const [improvements,setImprovements]=useState("");
  const [wouldUse,setWouldUse]=useState("Maybe");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(e){
    e.preventDefault();
    if(!rating){setError("Please choose a rating.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const res=await fetch("/api/public/demo-feedback",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({rating,category,worked,improvements,wouldUse})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Feedback could not be submitted.");
      setMessage("Thanks — your review was recorded for the demonstration.");
      setWorked("");setImprovements("");setRating(0);setWouldUse("Maybe");
    }catch(e){setError(e.message||"Feedback could not be submitted.");}
    finally{setBusy(false);}
  }

  return <div style={{fontFamily:FONT_BODY}}>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(280px,420px)",gap:18,alignItems:"start"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:22}}>
        <div style={{fontSize:11,fontWeight:800,color:C.primary,letterSpacing:.6,textTransform:"uppercase"}}>Public demonstration review</div>
        <h2 style={{margin:"6px 0 6px",fontSize:24,color:C.ink}}>Tell us what you think</h2>
        <p style={{margin:"0 0 18px",fontSize:13,color:C.inkSoft,lineHeight:1.55}}>This is a read-only synthetic demonstration. Review the workflow, evidence presentation, map, explanations and decision-support experience. Your comments are product feedback, not an official assessment.</p>
        {error&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:"#F8E6E3",color:C.high,fontSize:12}}>{error}</div>}
        {message&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:"#E1F0E6",color:"#1E6B45",fontSize:12,display:"flex",gap:7,alignItems:"center"}}><CheckCircle2 size={15}/>{message}</div>}
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:15}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:7}}>Overall impression</div>
            <div style={{display:"flex",gap:5}}>
              {[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} out of 5`} onClick={()=>setRating(n)} style={{border:`1px solid ${n<=rating?C.primary:C.border}`,background:n<=rating?C.tint:C.surface,borderRadius:7,padding:"7px 9px",cursor:"pointer"}}><Star size={17} fill={n<=rating?C.primary:"none"} color={n<=rating?C.primary:C.inkFaint}/></button>)}
            </div>
          </div>
          <label style={{fontSize:12,fontWeight:700,color:C.ink}}>What area are you reviewing?
            <select value={category} onChange={e=>setCategory(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"9px 10px",border:`1px solid ${C.border}`,borderRadius:7}}>{categories.map(x=><option key={x}>{x}</option>)}</select>
          </label>
          <label style={{fontSize:12,fontWeight:700,color:C.ink}}>What worked well?
            <textarea value={worked} onChange={e=>setWorked(e.target.value)} maxLength={2000} rows={4} placeholder="What was clear, useful or impressive?" style={{display:"block",width:"100%",marginTop:6,padding:10,border:`1px solid ${C.border}`,borderRadius:7,resize:"vertical"}}/>
          </label>
          <label style={{fontSize:12,fontWeight:700,color:C.ink}}>What should be improved?
            <textarea value={improvements} onChange={e=>setImprovements(e.target.value)} maxLength={2000} rows={4} placeholder="What was confusing, missing or unreliable?" style={{display:"block",width:"100%",marginTop:6,padding:10,border:`1px solid ${C.border}`,borderRadius:7,resize:"vertical"}}/>
          </label>
          <label style={{fontSize:12,fontWeight:700,color:C.ink}}>Would you use a system like this for a real workflow?
            <select value={wouldUse} onChange={e=>setWouldUse(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"9px 10px",border:`1px solid ${C.border}`,borderRadius:7}}><option>Yes</option><option>Maybe</option><option>No</option></select>
          </label>
          <button disabled={busy} type="submit" style={{display:"inline-flex",justifyContent:"center",alignItems:"center",gap:7,border:0,borderRadius:7,padding:"10px 14px",background:busy?"#8A948E":C.primary,color:"#fff",fontWeight:800,cursor:busy?"wait":"pointer"}}><Send size={15}/>{busy?"Submitting…":"Submit review"}</button>
        </form>
      </div>
      <div style={{background:"#F8FAF7",border:`1px solid ${C.border}`,borderRadius:12,padding:18}}>
        <div style={{fontSize:12,fontWeight:800,color:C.ink}}>What reviewers can test</div>
        <ul style={{margin:"10px 0 0",paddingLeft:19,color:C.inkSoft,fontSize:12.5,lineHeight:1.7}}>
          <li>Portfolio dashboard and drill-down navigation</li>
          <li>Project intelligence and evidence/provenance</li>
          <li>Interactive risk map and project locations</li>
          <li>Alerts, intervention logic and what-if scenarios</li>
          <li>Historical/replay and predictive-governance views</li>
          <li>Local evidence-grounded Bhoomi AI</li>
        </ul>
        <div style={{marginTop:15,padding:11,borderRadius:8,background:"#EEF0EA",fontSize:11.5,color:C.inkSoft,lineHeight:1.5}}>
          <strong style={{color:C.ink}}>Data boundary:</strong> public reviewers only see records explicitly classified as <code>synthetic_demo</code>. No government record, private project data, administrator control, bulk promotion or external AI provider is exposed.
        </div>
      </div>
    </div>
  </div>;
}

import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, XCircle, RefreshCw, KeyRound, Clock3, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

const C = { surface: '#FFFFFF', border: '#DBDFD4', ink: '#1B231C', inkSoft: '#586055', inkFaint: '#8A9184', primary: '#2F5C48', primaryTint: '#E4EDE6', high: '#AC2B22', highTint: '#F8E6E3', low: '#1E6B45', lowTint: '#E1F0E6', gold: '#8A6A32', goldTint: '#F3ECDB', sunk: '#EEF0EA' };
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const FONT_HEAD = "'Source Serif 4', Georgia, 'Times New Roman', serif";

function Card({ children }) { return <div className="rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>{children}</div>; }

export default function AdminAccessPage() {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [assignment, setAssignment] = useState({});
  const [projectOptions, setProjectOptions] = useState([]);

  async function load() {
    setLoading(true); setError('');
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/admin/access-requests', { credentials: 'include' }),
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/projects', { credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);
      const d1 = await r1.json().catch(() => ({}));
      const d2 = await r2.json().catch(() => ({}));
      const d3 = await r3.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error || 'Unable to load access requests.');
      if (!r2.ok) throw new Error(d2.error || 'Unable to load users.');
      if (!r3.ok) throw new Error(d3.error || 'Unable to load project scope options.');
      setRequests(Array.isArray(d1.requests) ? d1.requests : []);
      setUsers(Array.isArray(d2.users) ? d2.users : []);
      setProjectOptions(Array.isArray(d3.projects) ? d3.projects.map((p) => ({ id: p.id, name: p.name, code: p.code, state: p.state, district: p.district })) : []);
    } catch (e) { setError(e.message || 'Unable to load access administration.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function decide(id, decision, assignedRole) {
    setError(''); setResult(null);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ decision, assignedRole }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to decide access request.');
      if (data.provisionedAccount) setResult(data.provisionedAccount);
      await load();
    } catch (e) { setError(e.message || 'Unable to decide access request.'); }
  }

  async function saveAssignment(userId) {
    const a = assignment[userId] || {}; setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/assignment`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(a) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Unable to update account scope.');
      await load();
    } catch(e) { setError(e.message || 'Unable to update account scope.'); }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: FONT_BODY }}>
      <div className="flex items-end justify-between gap-4"><div><div style={{ color: C.inkFaint, fontSize: 12, marginBottom: 2 }}>Governance / authorised provisioning</div><h1 style={{ fontFamily: FONT_HEAD, color: C.ink, fontSize: 25, fontWeight: 700 }}>Access administration</h1><p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4 }}>Approve requests, assign operational roles and provision accounts. Users never grant themselves elevated access.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-md px-3 py-2" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.inkSoft, fontSize: 12, fontWeight: 700 }}><RefreshCw size={14} />Refresh</button></div>
      {error && <div className="rounded-md px-3 py-2.5" style={{ background: C.highTint, color: C.high, border: `1px solid ${C.high}33`, fontSize: 12 }}>{error}</div>}
      {result && <div className="rounded-lg p-4" style={{ background: C.lowTint, border: `1px solid ${C.low}33` }}><div className="flex items-start gap-3"><KeyRound size={17} color={C.low} /><div><div style={{ color: C.ink, fontWeight: 800, fontSize: 13 }}>Account provisioned</div><div style={{ color: C.inkSoft, fontSize: 11.5, marginTop: 3 }}>{result.email} · {result.role}</div><div className="mt-3 rounded-md px-3 py-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}><div style={{ fontSize: 10.5, color: C.inkFaint }}>Temporary password — show once, then require change</div><div style={{ marginTop: 2, fontFamily: 'monospace', fontSize: 13, color: C.ink, fontWeight: 800 }}>{result.temporaryPassword}</div></div></div></div></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><div className="p-4"><div style={{ fontSize: 11, color: C.inkFaint }}>Pending requests</div><div style={{ fontSize: 28, fontFamily: FONT_HEAD, fontWeight: 700, color: C.ink }}>{pending.length}</div></div></Card>
        <Card><div className="p-4"><div style={{ fontSize: 11, color: C.inkFaint }}>Active accounts</div><div style={{ fontSize: 28, fontFamily: FONT_HEAD, fontWeight: 700, color: C.ink }}>{users.filter((u) => u.status === 'active').length}</div></div></Card>
        <Card><div className="p-4"><div style={{ fontSize: 11, color: C.inkFaint }}>Supported profiles</div><div style={{ fontSize: 28, fontFamily: FONT_HEAD, fontWeight: 700, color: C.ink }}>5</div></div></Card>
      </div>

      <Card><div className="p-5"><div className="flex items-center gap-2 mb-3"><UserCheck size={16} color={C.primary} /><div style={{ fontWeight: 800, color: C.ink, fontSize: 14 }}>Pending access requests</div></div>{loading ? <div style={{ color: C.inkFaint, fontSize: 12 }}>Loading…</div> : pending.length === 0 ? <div style={{ color: C.inkFaint, fontSize: 12 }}>No pending requests.</div> : <div className="flex flex-col gap-3">{pending.map((r) => <div key={r.id} className="rounded-md p-4" style={{ border: `1px solid ${C.border}`, background: '#FAFBF8' }}><div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3"><div><div style={{ fontWeight: 800, color: C.ink, fontSize: 13 }}>{r.name}</div><div style={{ color: C.inkSoft, fontSize: 11.5, marginTop: 2 }}>{r.email} · {r.organisation}</div><div className="mt-2 flex items-center gap-2" style={{ fontSize: 10.8, color: C.gold }}><Clock3 size={13} />Requested {new Date(r.createdAt).toLocaleString()}</div><div className="mt-2" style={{ fontSize: 11.3, color: C.ink, lineHeight: 1.5 }}><strong>Requested profile:</strong> {r.requestedRole}<br/><strong>Reason:</strong> {r.justification}</div></div><div className="flex flex-wrap gap-2">{['Government Officer','Department Officer','Legal Officer','Viewer'].map((role) => <button key={role} onClick={() => decide(r.id, 'approve', role)} className="rounded-md px-3 py-2" style={{ border: `1px solid ${C.primary}44`, background: C.primaryTint, color: C.primary, fontSize: 10.8, fontWeight: 800 }}>Approve as {role}</button>)}<button onClick={() => decide(r.id, 'reject', r.requestedRole)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2" style={{ border: `1px solid ${C.high}44`, background: C.highTint, color: C.high, fontSize: 10.8, fontWeight: 800 }}><XCircle size={13} />Reject</button></div></div></div>)}</div>}</div></Card>

      <Card><div className="p-5"><div className="flex items-center gap-2 mb-3"><ShieldCheck size={16} color={C.primary} /><div style={{ fontWeight: 800, color: C.ink, fontSize: 14 }}>Provisioned accounts</div></div><div className="mb-3 rounded-md px-3 py-2" style={{background:C.sunk,border:`1px solid ${C.border}`,fontSize:10.8,color:C.inkSoft,lineHeight:1.45}}>Access profiles are application controls. Role, organisation, jurisdiction and project assignments must be mapped to the deploying authority's approved identity/governance structure; this screen does not assert an official cadre hierarchy.</div><div className="overflow-auto"><table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr><th className="text-left py-2" style={{ color: C.inkFaint }}>Name</th><th className="text-left py-2" style={{ color: C.inkFaint }}>Role</th><th className="text-left py-2" style={{ color: C.inkFaint }}>Organisation / authority</th><th className="text-left py-2" style={{ color: C.inkFaint }}>Project scope</th><th className="text-left py-2" style={{ color: C.inkFaint }}>Status</th></tr></thead><tbody>{users.map((u) => <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}><td className="py-2">{u.name}<div style={{ color: C.inkFaint, fontSize: 10.5 }}>{u.email}</div></td><td className="py-2 font-semibold">{u.role === 'Administrator' ? <span style={{fontSize:11,color:C.ink}}>{u.role}<div style={{fontSize:9.5,color:C.inkFaint,fontWeight:500}}>Protected profile</div></span> : <select value={assignment[u.id]?.role ?? u.role} onChange={e=>setAssignment(s=>({...s,[u.id]:{...s[u.id],role:e.target.value}}))} style={{border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 6px',fontSize:11}}>{['Government Officer','Department Officer','Legal Officer','Viewer'].map(r=><option key={r}>{r}</option>)}</select>}</td><td className="py-2"><div className="flex flex-col gap-1"><input value={assignment[u.id]?.organisation ?? u.organisation ?? ''} onChange={e=>setAssignment(s=>({...s,[u.id]:{...s[u.id],organisation:e.target.value}}))} placeholder="Organisation / authority / work unit" style={{border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 6px',fontSize:10.5}}/><div className="flex gap-1"><input value={assignment[u.id]?.state ?? u.jurisdiction?.state ?? ''} onChange={e=>setAssignment(s=>({...s,[u.id]:{...s[u.id],state:e.target.value}}))} placeholder="State" style={{border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 6px',fontSize:10.5,width:90}}/><input value={assignment[u.id]?.district ?? u.jurisdiction?.district ?? ''} onChange={e=>setAssignment(s=>({...s,[u.id]:{...s[u.id],district:e.target.value}}))} placeholder="District" style={{border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 6px',fontSize:10.5,width:95}}/></div></div></td>
<td className="py-2"><div style={{fontSize:10,color:C.inkFaint,marginBottom:3}}>Optional explicit project scope; leave empty to use state/district scope.</div><select multiple size={4} value={assignment[u.id]?.projectIds ?? u.jurisdiction?.projectIds ?? []} onChange={e=>setAssignment(s=>({...s,[u.id]:{...s[u.id],projectIds:Array.from(e.target.selectedOptions).map(o=>o.value)}}))} style={{minWidth:220,border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 6px',fontSize:10.2,background:C.surface}}>{projectOptions.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></td><td className="py-2"><div className="flex flex-col gap-1"><span className="inline-flex items-center gap-1" style={{ color: u.status === 'active' ? C.low : C.high }}>{u.status === 'active' ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>} {u.status}</span><button onClick={()=>saveAssignment(u.id)} className="inline-flex items-center gap-1 rounded px-2 py-1" style={{border:`1px solid ${C.border}`,background:C.surface,color:C.primary,fontSize:10.2,fontWeight:800}}><Save size={12}/>Save scope</button></div></td></tr>)}</tbody></table></div></div></Card>
    </div>
  );
}

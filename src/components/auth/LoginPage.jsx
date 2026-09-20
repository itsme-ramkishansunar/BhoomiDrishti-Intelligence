import React, { useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck, Loader2, AlertCircle, Server, Eye, EyeOff, UserPlus, Building2, ClipboardCheck, BriefcaseBusiness, Scale, FileCheck2, Eye as EyeIcon, Shield } from 'lucide-react';
import BrandMark from '../branding/BrandMark';

const C = { bg: '#F4F5F1', surface: '#FFFFFF', border: '#DBDFD4', ink: '#1B231C', inkSoft: '#586055', inkFaint: '#8A9184', primary: '#2F5C48', primaryTint:'#E4EDE6', gold: '#8A6A32', high: '#AC2B22', low: '#1E6B45' };
const FONT_HEAD = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiState, setApiState] = useState('checking');
  const [publicDemoEnabled, setPublicDemoEnabled] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [request, setRequest] = useState({ name: '', email: '', organisation: '', requestedRole: 'Government Officer', justification: '' });

  React.useEffect(() => {
    fetch('/api/health').then((r) => r.ok ? r.json() : null).then((data) => setApiState(data?.ok ? 'online' : 'offline')).catch(() => setApiState('offline'));
    fetch('/api/public/demo/config').then((r) => r.ok ? r.json() : null).then((data) => setPublicDemoEnabled(Boolean(data?.enabled))).catch(() => setPublicDemoEnabled(false));
  }, []);

  async function openPublicDemo() {
    setDemoLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/public/demo/session', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:'{}' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Public demo is unavailable.');
      onLogin(data.user);
    } catch (err) { setError(err.message || 'Public demo is unavailable.'); }
    finally { setDemoLoading(false); }
  }

  async function submitLogin(e) {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: email.trim(), password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to sign in.');
      onLogin(data.user);
    } catch (err) {
      setError(String(err.message || 'Unable to sign in.').includes('Failed to fetch') ? 'Authentication service is unavailable. Start the BHOOMIDHRISTI backend and try again.' : (err.message || 'Unable to sign in.'));
    } finally { setLoading(false); }
  }

  async function submitRequest(e) {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch('/api/access-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to submit access request.');
      setSuccess(`Access request ${data.request?.id || ''} submitted. An authorised administrator must review and provision the account.`);
      setRequest({ name: '', email: '', organisation: '', requestedRole: 'Government Officer', justification: '' });
    } catch (err) { setError(err.message || 'Unable to submit access request.'); }
    finally { setLoading(false); }
  }

  const profiles = [
    ['Administrator', 'System administration, security, audit and configuration.'],
    ['Government Officer', 'Portfolio oversight, risk review, interventions and escalation.'],
    ['Department Officer', 'Assigned departmental work, verification and workflow actions.'],
    ['Legal Officer', 'Legal/dispute review and evidence inspection.'],
    ['Viewer', 'Read-only dashboards, maps, history and reports.'],
  ];
  const [profilePreview, setProfilePreview] = useState('Government Officer');
  const profileIcons = { Administrator: Shield, 'Government Officer': BriefcaseBusiness, 'Department Officer': FileCheck2, 'Legal Officer': Scale, Viewer: EyeIcon };
  const profileNotes = { Administrator:'Privileged deployment profile. Must be provisioned by authorised administration.', 'Government Officer':'Assigned by administration to a defined jurisdiction, organisation and project scope.', 'Department Officer':'Assigned to operational responsibilities and specific departmental/project scopes.', 'Legal Officer':'Assigned to legal-review scope; legal decisions remain with the authorised legal function.', Viewer:'Read-only profile with no privileged mutation permissions.' };
  const chooseProfile = (role) => { setProfilePreview(role); setEmail(''); setPassword(''); setError(''); setSuccess(''); };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5 py-8" style={{ background: `radial-gradient(circle at 20% 10%, #E7EFEA, transparent 38%), linear-gradient(145deg, ${C.bg}, #FAFBF8)`, fontFamily: FONT_BODY }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center mb-7"><BrandMark showCompliance /></div>
        <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 24px 60px rgba(28,52,40,.10)' }}>
          <div className="px-6 pt-5 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="px-3 py-2.5 rounded-t-md" style={{ background: mode === 'login' ? '#EEF0EA' : 'transparent', color: C.ink, fontWeight: 700, fontSize: 12.5 }}>Sign in</button>
            <button onClick={() => { setMode('request'); setError(''); setSuccess(''); }} className="px-3 py-2.5 rounded-t-md" style={{ background: mode === 'request' ? '#EEF0EA' : 'transparent', color: C.ink, fontWeight: 700, fontSize: 12.5 }}><span className="inline-flex items-center gap-1.5"><UserPlus size={14} />Request access</span></button>
          </div>
          {mode === 'login' ? (
            <>
              <div className="p-6" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: '#E4EDE6' }}><ShieldCheck size={18} color={C.primary} /></div><div><div style={{ color: C.ink, fontWeight: 700, fontSize: 16 }}>Authorised sign in</div><div style={{ color: C.inkFaint, fontSize: 12, marginTop: 2 }}>Your role and permissions are assigned by the authentication service.</div></div></div><div className="inline-flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: apiState === 'online' ? '#E1F0E6' : apiState === 'checking' ? '#EEF0EA' : '#F8E6E3', color: apiState === 'online' ? C.low : apiState === 'checking' ? C.inkSoft : C.high, fontSize: 10.5, fontWeight: 700 }}><Server size={12} />{apiState === 'online' ? 'Service online' : apiState === 'checking' ? 'Checking service' : 'Service offline'}</div></div>
              </div>
              <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.border}`, background: '#FAFBF8' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.ink, marginBottom: 8 }}>Access profile</div>
                <div className="flex gap-1.5 overflow-auto" role="tablist" aria-label="Access profile guidance">
                  {profiles.map(([role])=>{const Icon=profileIcons[role]||ShieldCheck; return <button type="button" key={role} onClick={()=>chooseProfile(role)} role="tab" aria-selected={profilePreview===role} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5" style={{ border:`1px solid ${profilePreview===role?C.primary:C.border}`, background:profilePreview===role?C.primaryTint:C.surface, color:profilePreview===role?C.primary:C.inkSoft, fontSize:10.5, fontWeight:800 }}><Icon size={12}/>{role}</button>})}
                </div>
                <div className="mt-2 rounded-md px-3 py-2" style={{ background:C.surface, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:11.2, color:C.ink, fontWeight:700 }}>{profilePreview}</div>
                  <div style={{ marginTop:2, fontSize:10.5, color:C.inkSoft, lineHeight:1.45 }}>{profileNotes[profilePreview]}</div>
                </div>
                <div style={{ marginTop:7, fontSize:10.2, color:C.inkFaint }}>Selecting this tab does not grant a role. The authenticated identity service and administrator-assigned scope determine the actual permissions.</div>
                <div className="mt-3 rounded-md px-3 py-2.5" style={{ background:'#F7F8F5', border:`1px solid ${C.border}` }}><div style={{ fontSize:10.4, color:C.ink, fontWeight:800 }}>Use your provisioned credentials</div><div style={{ marginTop:3, fontSize:10.2, color:C.inkSoft, lineHeight:1.45 }}>This profile selector is guidance only. Usernames and passwords are not displayed or exposed in the browser. Sign in with the credentials issued by authorised administration.</div></div>
              </div>
              <form onSubmit={submitLogin} className="p-6 flex flex-col gap-4">
                {error && <div className="flex gap-2 items-start rounded-md px-3 py-2.5" style={{ background: '#F8E6E3', color: C.high, fontSize: 12 }}><AlertCircle size={15} /><span>{error}</span></div>}
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Official email / username</span><div className="relative"><Mail size={16} color={C.inkFaint} className="absolute left-3 top-1/2 -translate-y-1/2" /><input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@department.gov.in" className="w-full rounded-md pl-9 pr-3 py-2.5 outline-none" style={{ border: `1px solid ${C.border}`, fontSize: 13 }} /></div></label>
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Password</span><div className="relative"><LockKeyhole size={16} color={C.inkFaint} className="absolute left-3 top-1/2 -translate-y-1/2" /><input required autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-md pl-9 pr-10 py-2.5 outline-none" style={{ border: `1px solid ${C.border}`, fontSize: 13 }} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                <button type="submit" disabled={loading || apiState === 'offline'} className="w-full flex items-center justify-center gap-2 rounded-md py-2.5" style={{ background: loading || apiState === 'offline' ? '#8A948E' : C.primary, color: '#fff', fontWeight: 700, fontSize: 13 }}>{loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in securely'}</button>
                {publicDemoEnabled && <button type="button" onClick={openPublicDemo} disabled={demoLoading || apiState === 'offline'} className="w-full flex items-center justify-center gap-2 rounded-md py-2.5" style={{ background: demoLoading ? '#EEF0EA' : '#F7F8F5', color: C.primary, border:`1px solid ${C.border}`, fontWeight: 800, fontSize: 13 }}>{demoLoading ? <><Loader2 size={16} className="animate-spin" /> Opening public demo…</> : 'Explore public demo (read-only)'}</button>}
                {publicDemoEnabled && <div style={{fontSize:10.5,color:C.inkFaint,lineHeight:1.45}}>Public demo uses synthetic reference records, is read-only, and is provided for evaluation and feedback. It is not an official government system.</div>}
              </form>
            </>
          ) : (
            <form onSubmit={submitRequest} className="p-6 flex flex-col gap-4">
              <div className="rounded-lg p-3" style={{ background: '#EEF0EA', border: `1px solid ${C.border}` }}><div style={{ fontSize: 12, color: C.ink, fontWeight: 700 }}>Request an account</div><div style={{ marginTop: 4, fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>Choose the access you need to request. This does not grant access. An authorised administrator must review the request, assign permissions and provision the account.</div></div>
              {error && <div className="flex gap-2 items-start rounded-md px-3 py-2.5" style={{ background: '#F8E6E3', color: C.high, fontSize: 12 }}><AlertCircle size={15} /><span>{error}</span></div>}
              {success && <div className="flex gap-2 items-start rounded-md px-3 py-2.5" style={{ background: '#E1F0E6', color: C.low, fontSize: 12 }}><ClipboardCheck size={15} /><span>{success}</span></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Full name</span><input required value={request.name} onChange={(e) => setRequest((r) => ({ ...r, name: e.target.value }))} className="rounded-md px-3 py-2.5 outline-none" style={{ border: `1px solid ${C.border}`, fontSize: 13 }} /></label>
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Email / username</span><input required type="email" value={request.email} onChange={(e) => setRequest((r) => ({ ...r, email: e.target.value }))} className="rounded-md px-3 py-2.5 outline-none" placeholder="name@department.gov.in" style={{ border: `1px solid ${C.border}`, fontSize: 13 }} /></label>
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Organisation / office</span><div className="relative"><Building2 size={15} color={C.inkFaint} className="absolute left-3 top-1/2 -translate-y-1/2" /><input required value={request.organisation} onChange={(e) => setRequest((r) => ({ ...r, organisation: e.target.value }))} className="w-full rounded-md pl-9 pr-3 py-2.5 outline-none" style={{ border: `1px solid ${C.border}`, fontSize: 13 }} /></div></label>
                <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Requested access profile</span><select value={request.requestedRole} onChange={(e) => setRequest((r) => ({ ...r, requestedRole: e.target.value }))} className="rounded-md px-3 py-2.5 outline-none" style={{ border: `1px solid ${C.border}`, fontSize: 13 }}>{profiles.map(([role]) => <option key={role}>{role}</option>)}</select></label>
              </div>
              <label className="flex flex-col gap-1.5"><span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Reason for access</span><textarea required value={request.justification} onChange={(e) => setRequest((r) => ({ ...r, justification: e.target.value }))} className="rounded-md px-3 py-2.5 outline-none" rows={4} placeholder="Describe the work you need to perform and the data/workspace required." style={{ border: `1px solid ${C.border}`, fontSize: 13, resize: 'vertical' }} /></label>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-md py-2.5" style={{ background: loading ? '#8A948E' : C.primary, color: '#fff', fontWeight: 700, fontSize: 13 }}>{loading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><UserPlus size={16} />Submit access request</>}</button>
              <div style={{ fontSize: 10.8, color: C.inkFaint, lineHeight: 1.5 }}>Administrator accounts are not self-requestable. Final government deployment should connect this provisioning flow to the approved institutional identity and access-management process.</div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

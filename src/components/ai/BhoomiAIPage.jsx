import React, { useEffect, useRef, useState } from 'react';
import { Send, ShieldCheck, Database, Loader2, AlertTriangle, Sparkles, CheckCircle2, Trash2, RefreshCw, Link2 } from 'lucide-react';
import { COPY } from '../../content/copy';

const C = {
  surface: '#FFFFFF', surfaceSunk: '#EEF0EA', border: '#DBDFD4', ink: '#1B231C', inkSoft: '#586055', inkFaint: '#8A9184',
  primary: '#2F5C48', primaryTint: '#E4EDE6', high: '#AC2B22', highTint: '#F8E6E3', gold: '#8A6A32', goldTint:'#F3ECDB',
};
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const SUGGESTED_PROMPTS = [
  'Which projects need attention first?',
  'Why is NH-44 Expansion – Salem Section risky?',
  'Which project has the highest compensation risk?',
  'Where are the largest documentation gaps?',
  'Which district has the highest risk?',
  'What should we prioritise this week?',
];

function WelcomeMessage() {
  return { role: 'assistant', text: COPY?.ai?.greeting || "I'm Bhoomi AI. Ask about project risk, evidence or priorities.", analysis: null, messageId: null };
}

function EvidenceBlock({ analysis, projects = [] }) {
  if (!analysis || typeof analysis !== 'object') return null;
  const evidenceCoverage = Number.isFinite(Number(analysis.evidenceCoverage)) ? Number(analysis.evidenceCoverage) : (Number.isFinite(Number(analysis.confidence)) ? Number(analysis.confidence) : 0);
  const uncertainty = Number.isFinite(Number(analysis.uncertainty)) ? Number(analysis.uncertainty) : null;
  const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
  const evidenceRefs = Array.isArray(analysis.evidenceRefs) ? analysis.evidenceRefs : [];
  const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
  const relatedProjects = Array.isArray(analysis.relatedProjects) ? analysis.relatedProjects.map((p) => {
    const fallback = projects.find((candidate) => String(candidate?.id) === String(p?.id));
    const risk = Number.isFinite(Number(p?.risk)) ? Number(p.risk) : (Number.isFinite(Number(fallback?.risk?.overall)) ? Number(fallback.risk.overall) : null);
    return { ...p, name: p?.name || fallback?.name || 'Project', risk, band: p?.band || fallback?.risk?.band || 'unknown' };
  }) : [];
  return (
    <div className="mt-2 rounded-lg p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: C.ink }}><ShieldCheck size={13} color={C.primary} /> Evidence & confidence</div>
        {Number.isFinite(evidenceCoverage) && <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.primary, fontWeight: 700 }}>{Math.round(evidenceCoverage * 100)}% evidence coverage</span>}
      </div>
      {uncertainty !== null && <div className="mb-1.5" style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint }}>Uncertainty indicator: {Math.round(uncertainty * 100)}% · this is not a legal or statistical confidence guarantee.</div>}
      {evidence.slice(0, 5).map((e, i) => <div key={i} className="flex items-start gap-2 mb-1.5" style={{ fontFamily: FONT_BODY, fontSize: 11.8, color: C.inkSoft, lineHeight: 1.4 }}><CheckCircle2 size={12} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />{String(e)}</div>)}
      {evidenceRefs.length > 0 && <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-1.5" style={{ fontFamily: FONT_BODY, fontSize: 11.8, color: C.ink, fontWeight: 700, marginBottom: 4 }}><Link2 size={12} color={C.primary} /> Linked evidence records</div>
        {evidenceRefs.slice(0, 6).map((ref, i) => <div key={`${ref?.evidenceKey || 'e'}-${i}`} className="rounded px-2 py-1.5 mb-1.5" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between gap-2" style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 800, color: C.primary }}><span>{String(ref?.label || 'Evidence')}</span><span>{String(ref?.evidenceKey || 'record')}</span></div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.35, marginTop: 2 }}>{String(ref?.claim || '')}</div>
          {(ref?.source || ref?.provenance) && <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, marginTop: 2 }}>{[ref.source, ref.provenance].filter(Boolean).join(' · ')}</div>}
        </div>)}
      </div>}
      {recommendations.length > 0 && <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}><div style={{ fontFamily: FONT_BODY, fontSize: 11.8, color: C.ink, fontWeight: 700, marginBottom: 4 }}>Recommended next steps</div>{recommendations.slice(0, 3).map((r, i) => <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 11.8, color: C.inkSoft, lineHeight: 1.4, marginBottom: 3 }}>{i + 1}. {String(r)}</div>)}</div>}
      {relatedProjects.length > 0 && <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}><div style={{ fontFamily: FONT_BODY, fontSize: 11.8, color: C.ink, fontWeight: 700, marginBottom: 4 }}>Related project records</div>{relatedProjects.slice(0, 4).map((p, i) => <div key={p?.id || i} className="flex items-center justify-between gap-3" style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.4, marginBottom: 3 }}><span>{String(p?.name || 'Project')}</span><span style={{ color: C.primary, fontWeight: 700 }}>{Number.isFinite(Number(p?.risk)) ? `${Number(p.risk)}/100` : '—'}</span></div>)}</div>}
    </div>
  );
}

function ErrorPanel({ error, onRetry }) {
  if (!error) return null;
  return <div className="flex gap-2 items-center justify-between rounded-md px-3 py-2 mb-2" style={{ background: C.highTint, color: C.high, fontSize: 11.5 }}><div className="flex items-center gap-2"><AlertTriangle size={14} />{error}</div>{onRetry && <button onClick={onRetry} className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.ink, fontWeight: 700 }}><RefreshCw size={12}/>Retry</button>}</div>;
}

function hydrateStoredMessage(m) {
  return { role: m.role, text: m.text || m.content || '', messageId: m.id || null, createdAt: m.createdAt, analysis: { evidenceCoverage: m.evidenceCoverage, confidence: m.confidence, uncertainty: m.uncertainty, evidence: m.evidence || [], evidenceRefs: m.evidenceRefs || [], recommendations: m.recommendations || [], relatedProjects: m.relatedProjects || [] } };
}

export default function BhoomiAIPage({ scored, initialProjectId = '', onClearProject }) {
  const safeProjects = Array.isArray(scored) ? scored : [];
  const [contextProjectId, setContextProjectId] = useState(initialProjectId || '');
  const contextProject = safeProjects.find((p) => String(p.id) === String(contextProjectId));
  const [messages, setMessages] = useState([WelcomeMessage()]);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState('local-evidence-engine');
  const [providerStatus, setProviderStatus] = useState(null);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const lastFailedQuestion = useRef('');

  useEffect(() => { setContextProjectId(initialProjectId || ''); }, [initialProjectId]);
  useEffect(() => {
    try { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); } catch (_) {}
  }, [messages, loading]);

  async function archiveSession(id) {
    if (!id) return;
    try { await fetch(`/api/ai/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } }); } catch (_) {}
  }

  async function loadLatestSession(projectId, cancelledRef) {
    setBooting(true); setError('');
    try {
      const url = projectId ? `/api/ai/sessions?projectId=${encodeURIComponent(projectId)}` : '/api/ai/sessions';
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Could not load the saved Bhoomi AI session.');
      const body = await res.json();
      const latest = body?.sessions?.[0];
      if (!latest) { if (!cancelledRef.cancelled) { setSessionId(''); setMessages([WelcomeMessage()]); } return; }
      const detail = await fetch(`/api/ai/sessions/${encodeURIComponent(latest.id)}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!detail.ok) throw new Error('Saved Bhoomi AI session could not be opened.');
      const payload = await detail.json();
      if (!cancelledRef.cancelled) {
        setSessionId(latest.id);
        setMessages((payload?.messages || []).map(hydrateStoredMessage).filter(m => m.text || m.role === 'user'));
        if (!(payload?.messages || []).length) setMessages([WelcomeMessage()]);
        const lastAssistant = [...(payload?.messages || [])].reverse().find(m => m.role === 'assistant');
        if (lastAssistant?.mode) setMode(lastAssistant.mode);
      }
    } catch (e) {
      if (!cancelledRef.cancelled) { setSessionId(''); setMessages([WelcomeMessage()]); setError(e?.message || 'Could not load saved AI context.'); }
    } finally { if (!cancelledRef.cancelled) setBooting(false); }
  }

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    loadLatestSession(initialProjectId || '', cancelledRef);
    return () => { cancelledRef.cancelled = true; };
  }, [initialProjectId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/status', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then(body => { if (!cancelled && body) setProviderStatus(body); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function send(question = input) {
    const q = String(question ?? '').trim();
    if (!q || loading) return;
    setInput(''); setError(''); lastFailedQuestion.current = q;
    setMessages((m) => [...m, { role: 'user', text: q }]); setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 18000);
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include',
        body: JSON.stringify({ sessionId: sessionId || undefined, question: q, projectId: contextProjectId || undefined }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeoutId));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `AI service unavailable (${res.status}).`);
      setSessionId(body?.sessionId || sessionId || '');
      setMode(body?.mode || 'local-evidence-engine');
      if (body?.warning) setError(body.warning.includes('unavailable') ? 'Private AI provider unavailable; using the local evidence engine.' : body.warning);
      setMessages((m) => [...m, { role: 'assistant', text: body?.text || 'No answer was generated.', messageId: body?.messageId || null, analysis: { evidenceCoverage: body?.evidenceCoverage ?? body?.confidence, confidence: body?.confidence, uncertainty: body?.uncertainty, evidence: body?.evidence, evidenceRefs: body?.evidenceRefs, recommendations: body?.recommendations, relatedProjects: body?.relatedProjects } }]);
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'Private AI took too long. The local evidence engine remains available; retry or switch the provider to local mode.' : (e?.message || 'AI service unavailable.');
      setError(msg.includes('fetch') ? 'BHOOMIDHRISTI backend is unreachable. Start the backend service and retry.' : msg);
      setMessages((m) => [...m, { role: 'assistant', text: 'Bhoomi AI could not complete this request. Use Retry after checking that the BHOOMIDHRISTI backend is running.' }]);
    } finally { setLoading(false); }
  }

  const clearContext = async () => { await archiveSession(sessionId); setSessionId(''); setMessages([WelcomeMessage()]); setError(''); setMode('local-evidence-engine'); setContextProjectId(''); onClearProject?.(); };
  const clearChat = async () => { await archiveSession(sessionId); setSessionId(''); setError(''); lastFailedQuestion.current=''; setMode('local-evidence-engine'); setMessages([WelcomeMessage()]); };
  const retry = () => lastFailedQuestion.current && send(lastFailedQuestion.current);
  const changeContext = async (nextId) => { if (nextId === contextProjectId) return; await archiveSession(sessionId); setSessionId(''); setMessages([WelcomeMessage()]); setError(''); setMode('local-evidence-engine'); setContextProjectId(nextId); };
  const modeLabel = mode === 'gemini-private-proxy' ? 'Gemini · server-side Interactions' : mode === 'anthropic-private-proxy' ? 'Claude · private backend proxy' : mode === 'local-evidence-engine-fallback' ? 'Local evidence engine · fallback' : 'Local evidence engine';
  const availabilityLabel = providerStatus?.externalEnabled ? `${modeLabel}` : 'Local evidence engine · provider disabled';

  return <div className="flex flex-col" style={{ height: 'clamp(600px, 74vh, 780px)', minHeight: 600, maxHeight: 780, fontFamily: FONT_BODY, width: '100%', maxWidth: 1680, margin: '0 auto' }}>
    <div className="flex items-end justify-between mb-3">
      <div>
        <div style={{ fontSize: 13.5, color: C.inkFaint }}>{COPY?.ai?.eyebrow || 'Grounded in the authorised project data available to this session'}</div>
        <div className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: C.ink }}><Sparkles size={18} color={C.gold} />{COPY?.ai?.title || 'Bhoomi AI — Evidence-Grounded Decision Support'}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {contextProject && <div className="flex items-center gap-1.5 rounded px-2.5 py-1.5" style={{ background: C.goldTint, color: C.gold, fontSize: 12.5, fontWeight: 700 }}><Database size={13}/> Project context: {contextProject.name}<button onClick={clearContext} title="Clear project context" style={{ marginLeft: 4, color: C.gold }}><span aria-hidden="true">×</span></button></div>}
        <select value={contextProjectId} onChange={(e) => changeContext(e.target.value)} aria-label="Project AI context" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.inkSoft, borderRadius: 6, padding: '6px 8px', fontSize: 12.5, fontWeight: 700, maxWidth: 250 }}><option value="">Portfolio context</option>{safeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button onClick={clearChat} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.inkSoft, fontSize: 12.5, fontWeight: 600 }}><Trash2 size={13} /> New chat</button>
        <div className="flex items-center gap-2 rounded px-2.5 py-1.5" style={{ background: C.primaryTint, color: C.primary, fontSize: 12.5, fontWeight: 700 }}><ShieldCheck size={14} /> {availabilityLabel}</div>
      </div>
    </div>
    {sessionId && <div className="mb-2 flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 11.2, color: C.inkFaint }}><CheckCircle2 size={12} color={C.primary}/> Conversation saved server-side · follow-up questions resolve against the recorded session context.</div>}
    <ErrorPanel error={error} onRetry={retry} />
    {contextProject && <div className="mb-2 rounded-md px-3 py-2" style={{ background: C.primaryTint, border: `1px solid ${C.border}`, color: C.primary, fontSize: 12.2, lineHeight: 1.5 }}><b>{contextProject.name}</b> is selected. Bhoomi AI will answer from this project's authorised record unless you switch back to portfolio context.</div>}
    <div className="rounded-xl flex-1 overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}`, position: 'relative', minHeight: 0, boxShadow: '0 2px 8px rgba(27,35,28,0.05)', display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-5 py-5 md:px-7 md:py-7" style={{ minHeight: 0, scrollbarGutter: 'stable' }}>
        {booting && messages.length === 1 && <div className="flex"><div className="flex items-center gap-2 rounded" style={{ background: C.surfaceSunk, color: C.inkFaint, padding: '11px 15px', fontSize: 13.5 }}><Loader2 size={14} className="animate-spin" /> Loading saved conversation context…</div></div>}
        <div className={messages.length === 1 && !booting ? 'min-h-0 flex items-center justify-center' : 'flex flex-col gap-3 mx-auto w-full max-w-[1180px]'}>
          {messages.length === 1 && !booting ? (
            <div style={{ width: '100%', maxWidth: 1080, textAlign: 'center', padding: '18px 16px 24px' }}>
              <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 50, height: 50, background: C.primaryTint, color: C.primary }}>
                <Sparkles size={24} color={C.primary} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 750, color: C.ink }}>Decision support, grounded in project evidence</div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: C.inkFaint, lineHeight: 1.55 }}>Ask a specific question about risk, bottlenecks, evidence gaps, legal exposure, geography or priority actions.</div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SUGGESTED_PROMPTS.map((prompt) => <button key={prompt} onClick={() => send(prompt)} className="text-left rounded-lg px-3 py-2.5 transition" style={{ background: C.surfaceSunk, color: C.ink, border: `1px solid ${C.border}`, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}>{prompt}</button>)}
              </div>
            </div>
          ) : messages.map((m, i) => <div key={m.messageId || `${m.role}-${i}`} className="flex" style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <div style={{ maxWidth: '86%', background: m.role === 'user' ? C.primary : C.surfaceSunk, color: m.role === 'user' ? '#fff' : C.ink, borderRadius: 10, padding: '13px 16px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            <div>{String(m.text ?? '')}</div>
            {m.role === 'assistant' && m.analysis && <EvidenceBlock analysis={m.analysis} projects={safeProjects} />}
          </div>
        </div>)}
          {loading && <div className="flex mt-3"><div className="flex items-center gap-2 rounded-lg" style={{ background: C.surfaceSunk, color: C.inkFaint, padding: '11px 15px', fontSize: 13.5 }}><Loader2 size={14} className="animate-spin" /> {COPY?.ai?.loading || 'Analysing current project data…'}</div></div>}
        </div>
        <div className="mt-3 px-1" style={{ color: C.inkFaint, fontSize: 11.5 }}><div className="flex items-center gap-2"><Database size={13} /> {COPY?.ai?.dataNote || 'Uses the authorised project records available to this session.'}</div></div>
      </div>
      <div className="flex-shrink-0" style={{ padding: '14px 16px 14px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <div className="flex items-end gap-2"><textarea value={input} maxLength={12000} rows={1} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={COPY?.ai?.inputPlaceholder || 'Ask Bhoomi AI a multi-part question…'} style={{ flex: 1, resize: 'vertical', minHeight: 52, maxHeight: 180, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.45 }} /><button onClick={() => send()} disabled={loading || booting || !String(input).trim()} className="inline-flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: loading ? C.inkFaint : C.primary, color: '#fff', fontWeight: 700, fontSize: 13.5, opacity: !String(input).trim() ? 0.55 : 1 }}><Send size={14} /> {loading ? 'Analysing…' : 'Send'}</button></div><div className="mt-1 flex items-center justify-between" style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint }}><span>Enter to send · Shift+Enter for a new line · up to 12,000 characters</span><span>{String(input).length}/12,000</span></div>
      </div>
    </div>
  </div>;
}

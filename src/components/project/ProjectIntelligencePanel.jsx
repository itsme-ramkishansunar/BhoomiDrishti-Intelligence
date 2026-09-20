import React from 'react';
import { FileText, UserCheck, AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';

const C = { bg: '#F4F5F1', surface: '#FFFFFF', surfaceSunk: '#EEF0EA', border: '#DBDFD4', ink: '#1B231C', inkSoft: '#586055', inkFaint: '#8A9184', primary: '#2F5C48', primaryTint: '#E4EDE6', gold: '#8A6A32', high: '#AC2B22', highTint: '#F8E6E3', med: '#95600A', medTint: '#F7EDD9', low: '#1E6B45', lowTint: '#E1F0E6' };
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

const DOCS = [
  { id: 'notification', name: 'Acquisition notification / declaration', desc: 'Applicable notification/declaration set and evidence of publication, as required by the project statute.', owner: 'Land Acquisition Officer', status: 'required' },
  { id: 'ror', name: 'Record of Rights / land record extract', desc: 'Current ownership/Record of Rights extract mapped to each affected survey or parcel entry.', owner: 'Revenue / Records Officer', status: 'required' },
  { id: 'survey', name: 'Survey / cadastral plan', desc: 'Survey identifiers, cadastral references, parcel geometry and acquisition extent.', owner: 'Survey / Settlement Officer', status: 'required' },
  { id: 'award', name: 'Award / compensation assessment', desc: 'Award reference, valuation basis and affected-party schedule for the applicable acquisition stage.', owner: 'Land Acquisition Officer', status: 'stage' },
  { id: 'payment', name: 'Compensation payment evidence', desc: 'Payment status, pending cases, failed or reversed transactions and reconciliation evidence.', owner: 'Accounts / Compensation Officer', status: 'stage' },
  { id: 'rr', name: 'R&R / rehabilitation records', desc: 'Entitlement, site readiness and rehabilitation progress where applicable to the project.', owner: 'R&R Officer', status: 'stage' },
  { id: 'court', name: 'Court orders / dispute documents', desc: 'Orders, stays, case status and parcel-linked litigation evidence where a dispute exists.', owner: 'Legal Officer', status: 'conditional' },
];

function Status({ state }) {
  const cfg = state === 'missing' ? [C.highTint, C.high, 'Missing'] : state === 'review' ? [C.medTint, C.med, 'Needs review'] : state === 'verified' ? [C.lowTint, C.low, 'Verified'] : [C.surfaceSunk, C.inkSoft, 'Required'];
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: cfg[0], color: cfg[1], fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: cfg[1] }} />{cfg[2]}</span>;
}

export default function ProjectIntelligencePanel({ project, risk }) {
  const missing = Number(project.docsMissing || 0);
  const disputeRisk = Number(risk?.categories?.legal || 0) >= 60;
  const compensationRisk = Number(risk?.categories?.compensation || 0) >= 60;
  const approvalRisk = Number(risk?.categories?.approval || 0) >= 60;
  const stage = Number(project.stageIndex || 0);
  const docRows = DOCS.map((d, idx) => {
    let state = 'verified';
    if (d.id === 'notification' && stage <= 1) state = 'review';
    else if (d.id === 'award' && stage >= 4) state = stage >= 7 ? 'verified' : 'review';
    else if (d.id === 'payment' && stage >= 4) state = compensationRisk ? 'missing' : 'review';
    else if (d.id === 'rr' && stage >= 6) state = (project.resettlementPct || 0) < 80 ? 'missing' : 'review';
    else if (d.id === 'court' && disputeRisk) state = 'review';
    else if (d.id === 'survey' && missing > 0) state = 'review';
    if (idx > 4 && stage < 4) state = 'required';
    return { ...d, state };
  });
  const blockers = [];
  if (missing > 0) blockers.push({ title: `${missing} documents are missing or incomplete`, detail: 'The system needs category-level document reconciliation before this project can be treated as fully verified.', owner: 'Records / Documentation Officer', severity: 'high' });
  if (compensationRisk) blockers.push({ title: 'Compensation backlog needs officer review', detail: `${project.familiesPending} of ${project.familiesAffected} affected families are pending in the loaded record.`, owner: 'Compensation Officer', severity: 'high' });
  if (disputeRisk) blockers.push({ title: 'Legal/dispute exposure requires legal verification', detail: `${project.disputes} ownership disputes and ${project.courtCases} court cases are recorded.`, owner: 'Legal Officer', severity: 'high' });
  if (approvalRisk) blockers.push({ title: 'Approvals are below the monitoring threshold', detail: `Only ${project.approvalPct}% of tracked approvals are complete in the current dataset.`, owner: 'Approving Authority / Nodal Officer', severity: 'medium' });

  const officerRows = [
    ['Field / Acquisition level', 'Review current acquisition stage and unresolved field cases', stage >= 2 ? 'Needs verification' : 'Pending'],
    ['Revenue / Records level', missing > 0 ? `Resolve ${missing} document/record gaps` : 'Verify ownership and land records', missing > 0 ? 'Action required' : 'No gap indicated'],
    ['Compensation / Accounts level', compensationRisk ? `Reconcile ${project.familiesPending} pending compensation cases` : 'Monitor payment queue', compensationRisk ? 'Action required' : 'Monitoring'],
    ['Legal / Dispute level', disputeRisk ? 'Review active disputes, stays and orders' : 'No immediate legal escalation indicated', disputeRisk ? 'Action required' : 'No escalation indicated'],
    ['R&R / Rehabilitation level', stage >= 6 ? 'Verify R&R and rehabilitation completion evidence' : 'Not yet the active stage', stage >= 6 && (project.resettlementPct || 0) < 80 ? 'Action required' : 'Planned'],
    ['District / Nodal approval level', approvalRisk ? 'Review outstanding statutory/administrative approvals' : 'Monitor approval queue', approvalRisk ? 'Pending approval' : 'No exception indicated'],
  ];

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-md p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3"><div><div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: .6 }}>Evidence checklist</div><div style={{ fontFamily: FONT_BODY, fontWeight: 700, color: C.ink, fontSize: 15 }}>Documents &amp; records to verify</div></div><FileText size={18} color={C.primary} /></div>
          <div className="flex flex-col gap-2">{docRows.map(d => <div key={d.id} className="flex items-start gap-3 rounded px-3 py-2" style={{ background: C.bg || '#F4F5F1', border: `1px solid ${C.border}` }}><div className="mt-0.5"><FileText size={14} color={C.inkFaint} /></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12.5, color: C.ink }}>{d.name}</div><Status state={d.state} /></div><div style={{ fontFamily: FONT_BODY, fontSize: 11.2, color: C.inkSoft, marginTop: 2 }}>{d.desc}</div><div className="flex items-center gap-1 mt-1" style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint }}><UserCheck size={11} /> Responsible: {d.owner}</div></div></div>)}</div>
        </div>

        <div className="rounded-md p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3"><div><div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: .6 }}>Officer accountability</div><div style={{ fontFamily: FONT_BODY, fontWeight: 700, color: C.ink, fontSize: 15 }}>Who needs to verify / approve</div></div><ShieldAlert size={18} color={C.gold} /></div>
          <div className="overflow-auto"><table className="w-full"><thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{['Role / level', 'Required action', 'Current signal'].map(h => <th key={h} className="text-left pb-2 pr-3" style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, fontWeight: 700 }}>{h}</th>)}</tr></thead><tbody>{officerRows.map(([role, action, state]) => <tr key={role} style={{ borderBottom: `1px solid ${C.border}` }}><td className="py-2 pr-3" style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 700, color: C.ink }}>{role}</td><td className="py-2 pr-3" style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>{action}</td><td className="py-2" style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700, color: state.includes('Action') || state.includes('required') || state.includes('Pending') || state.includes('Not cleared') ? C.high : C.inkSoft }}>{state}</td></tr>)}</tbody></table></div>
          <div className="mt-3 rounded-md px-3 py-2" style={{ background: C.primaryTint, color: C.primary, fontFamily: FONT_BODY, fontSize: 11.2 }}><b>Important:</b> document requirements and workflow levels depend on the applicable statute, project stage and authorized government configuration. These labels are decision-support guidance, not a legal designation of a specific officer's statutory authority.</div>
        </div>
      </div>

      <div className="rounded-md p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3"><Clock3 size={16} color={C.primary} /><div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>Current blockers requiring action</div></div>
        {blockers.length ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{blockers.map((b, i) => <div key={i} className="rounded-md px-3 py-2.5" style={{ border: `1px solid ${b.severity === 'high' ? '#E8C1BC' : '#E7D2A7'}`, background: b.severity === 'high' ? C.highTint : C.medTint }}><div className="flex items-start gap-2"><AlertTriangle size={14} color={b.severity === 'high' ? C.high : C.med} /><div><div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: C.ink }}>{b.title}</div><div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{b.detail}</div><div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, marginTop: 4 }}>Responsible: {b.owner}</div></div></div></div>)}</div> : <div className="flex items-center gap-2 rounded px-3 py-2" style={{ background: C.lowTint, color: C.low, fontFamily: FONT_BODY, fontSize: 12 }}><CheckCircle2 size={15} />No critical blocker is indicated by the currently loaded data.</div>}
      </div>
    </div>
  );
}

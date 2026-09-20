import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BrainCircuit, Clock3, ShieldCheck, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, CartesianGrid, Cell, LineChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

const C = {
  surface: '#FFFFFF', surfaceSunk: '#EEF0EA', border: '#DBDFD4', ink: '#1B231C', inkSoft: '#586055', inkFaint: '#8A9184',
  primary: '#2F5C48', primaryTint: '#E4EDE6', high: '#AC2B22', highTint: '#F8E6E3', med: '#95600A', medTint: '#F7EDD9', gold: '#8A6A32', goldTint: '#F3ECDB',
};
const FONT = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

function tone(value) { return value >= 70 ? [C.high, C.highTint] : value >= 55 ? [C.med, C.medTint] : [C.primary, C.primaryTint]; }
function compactLabel(label = '') { return String(label).replace(/\s+Risk$/i, '').replace(/R&R/g, 'R&R'); }

export default function PredictiveIntelligencePanel({ project }) {
  const [state, setState] = useState({ loading: true, error: '', payload: null });
  const [mlGate, setMlGate] = useState(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '', payload: null });
    fetch(`/api/projects/${encodeURIComponent(project.id)}/predictive-intelligence`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : r.json().catch(() => ({})).then(x => Promise.reject(new Error(x.error || 'Predictive intelligence unavailable.'))))
      .then(payload => { if (!cancelled) setState({ loading: false, error: '', payload }); })
      .catch(err => { if (!cancelled) setState({ loading: false, error: err.message || 'Predictive intelligence unavailable.', payload: null }); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ml/readiness', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(x => { if (!cancelled) setMlGate(x); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const p = state.payload?.prediction;
  const trajectory = useMemo(() => Array.isArray(p?.trajectory) ? p.trajectory.map(x => ({ ...x, likelihoodPct: Number(x.likelihoodPct) || 0 })) : [], [p]);
  const drivers = useMemo(() => Array.isArray(p?.explanations)
    ? p.explanations.slice(0, 6).map(d => ({ ...d, contribution: Number(d.contribution) || 0, shortLabel: compactLabel(d.label) }))
    : [], [p]);

  if (state.loading) return <div className="rounded-md p-4" style={{ background: C.surface, border: `1px solid ${C.border}`, fontFamily: FONT, fontSize: 12, color: C.inkFaint }}>Building candidate predictive signal…</div>;
  if (state.error) return <div className="rounded-md p-4" style={{ background: C.highTint, border: `1px solid ${C.high}33`, fontFamily: FONT, fontSize: 12, color: C.high }}><div className="flex items-center gap-2"><AlertTriangle size={14} />{state.error}</div></div>;
  if (!p) return null;

  const [signalColor, signalBg] = tone(Number(p.delayLikelihoodPct));
  const chartData = drivers.map(d => ({ name: d.shortLabel, contribution: d.contribution }));

  return (
    <div className="rounded-md p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: C.ink }}>
            <BrainCircuit size={17} color={C.primary} /> Predictive intelligence
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.inkFaint, marginTop: 3 }}>
            Candidate forecast automatically derived for <b>{project.name}</b> from the current project record using the as-of feature policy.
          </div>
        </div>
        <span className="px-2 py-1 rounded" style={{ background: C.goldTint, color: C.gold, fontFamily: FONT, fontSize: 10.5, fontWeight: 800 }}>
          CANDIDATE · NOT VALIDATED
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        <div className="rounded-md p-3" style={{ background: signalBg, border: `1px solid ${signalColor}33` }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.inkSoft }}>Delay-likelihood signal</div>
          <div style={{ fontFamily: FONT, fontSize: 27, fontWeight: 800, color: signalColor, marginTop: 2 }}>{p.delayLikelihoodPct}%</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Not a calibrated production probability.</div>
        </div>
        <div className="rounded-md p-3" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 11, color: C.inkSoft }}><Clock3 size={12} />Expected additional delay</div>
          <div style={{ fontFamily: FONT, fontSize: 27, fontWeight: 800, color: C.ink, marginTop: 2 }}>{p.expectedAdditionalDays}d</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Candidate estimate from current signals.</div>
        </div>
        <div className="rounded-md p-3" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.inkSoft }}>Current stage hazard</div>
          <div style={{ fontFamily: FONT, fontSize: 27, fontWeight: 800, color: C.ink, marginTop: 2 }}>{p.stageHazardPct}%</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Forward stage-pressure signal.</div>
        </div>
        <div className="rounded-md p-3" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 11, color: C.inkSoft }}><ShieldCheck size={12} />Data completeness</div>
          <div style={{ fontFamily: FONT, fontSize: 27, fontWeight: 800, color: C.ink, marginTop: 2 }}>{p.dataCompletenessPct}%</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Uncertainty: {p.uncertaintyPct}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 items-start">
        <div className="rounded-md p-3" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 mb-2" style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: C.ink }}><TrendingUp size={14} color={C.primary} /> Risk trajectory</div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectory} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="horizon" tick={{ fontFamily: FONT, fontSize: 10, fill: C.inkFaint }} tickLine={false} axisLine={{ stroke: C.border }} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: FONT, fontSize: 10, fill: C.inkFaint }} tickLine={false} axisLine={{ stroke: C.border }} width={34} />
                <Tooltip formatter={(value) => [`${value}%`, 'Delay signal']} contentStyle={{ fontFamily: FONT, fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}` }} />
                <Line type="monotone" dataKey="likelihoodPct" stroke={C.high} strokeWidth={3} dot={{ r: 4, fill: C.high }} activeDot={{ r: 7 }} onClick={(entry)=>setSelectedChartPoint({kind:"trajectory",...entry.payload})} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {trajectory.map(item => {
              const [col, bg] = tone(Number(item.likelihoodPct));
              return <div key={item.horizon} className="rounded px-2.5 py-2" style={{ background: bg, border: `1px solid ${col}22` }}><div style={{ fontFamily: FONT, fontSize: 10, color: C.inkFaint }}>{item.horizon}</div><div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: col, marginTop: 2 }}>{item.likelihoodPct}%</div></div>;
            })}
          </div>
        </div>

        <div className="rounded-md p-3" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 2 }}>Top predictive signals</div>
          <div style={{ fontFamily: FONT, fontSize: 10.5, color: C.inkFaint, marginBottom: 6 }}>Contribution is a model-derived signal, not a causal effect.</div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 20, bottom: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontFamily: FONT, fontSize: 10, fill: C.inkFaint }} tickLine={false} axisLine={{ stroke: C.border }} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontFamily: FONT, fontSize: 9.5, fill: C.inkSoft }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`+${value}`, 'Contribution']} contentStyle={{ fontFamily: FONT, fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}` }} />
                <Bar dataKey="contribution" radius={[0, 4, 4, 0]} maxBarSize={22} onClick={(entry)=>setSelectedChartPoint({kind:"driver",...entry.payload})}>
                  {chartData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={index === 0 ? C.high : C.primary} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {drivers.map((d, idx) => <div key={d.key} className="rounded px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}><div className="flex items-center justify-between gap-3"><span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 700, color: C.ink }}>{d.label}</span><span style={{ fontFamily: FONT, fontSize: 11, color: idx === 0 ? C.high : C.primary, fontWeight: 800 }}>+{d.contribution}</span></div><div style={{ fontFamily: FONT, fontSize: 10.5, color: C.inkFaint, marginTop: 2 }}>{d.direction}</div></div>)}
          </div>
        </div>
      </div>

      {selectedChartPoint && <div className="mt-3 rounded-md px-3 py-2.5" style={{background:C.surface,border:`1px solid ${C.border}`,fontFamily:FONT,fontSize:11,color:C.soft,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><b style={{color:C.ink}}>{selectedChartPoint.kind==="trajectory"?`Trajectory · ${selectedChartPoint.horizon}`:`Signal · ${selectedChartPoint.name}`}</b><div style={{marginTop:3}}>{selectedChartPoint.kind==="trajectory"?`${selectedChartPoint.likelihoodPct}% candidate delay-like signal at this horizon.`:`Contribution +${selectedChartPoint.contribution}. This is a model-derived association, not a causal effect.`}</div></div><button type="button" onClick={()=>setSelectedChartPoint(null)} style={{border:`1px solid ${C.border}`,background:C.surfaceSunk,borderRadius:6,padding:"5px 8px",fontSize:10,fontWeight:700,color:C.ink}}>Clear</button></div>}

      {mlGate && <div className="mt-4 rounded-md px-3 py-2.5" style={{ background: mlGate.gate?.productionPromotionAllowed ? C.primaryTint : C.goldTint, border: `1px solid ${(mlGate.gate?.productionPromotionAllowed ? C.primary : C.gold)}33`, fontFamily: FONT, fontSize: 10.8, color: C.inkSoft, lineHeight: 1.45 }}><b style={{ color: C.ink }}>Model governance:</b> {mlGate.gate?.productionPromotionAllowed ? 'Eligible for explicit human model approval.' : 'Production promotion is blocked pending dataset, temporal evaluation, calibration, OOD and approval gates.'}</div>}

      <div className="mt-4 rounded-md px-3 py-2.5" style={{ background: C.goldTint, border: `1px solid ${C.gold}33`, fontFamily: FONT, fontSize: 10.8, color: C.inkSoft, lineHeight: 1.45 }}>
        <b style={{ color: C.ink }}>Automatic project behavior:</b> risk, predictive signals, evidence panels, workflow/legal checks, recommendations and action controls resolve from the selected project's ID and current fields. Newly created projects therefore enter the same intelligence pipeline automatically; no project-specific component wiring is required.
        <div style={{ marginTop: 4 }}><b style={{ color: C.ink }}>Validation status:</b> {p.validation?.reason} The production path is temporal, project-level validation with leakage checks and calibrated probability before model approval.</div>
      </div>
    </div>
  );
}

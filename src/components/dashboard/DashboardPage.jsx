import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, RefreshCw, Database, Search, Filter, RotateCcw, UploadCloud, Zap, X,
  FileCheck2, FolderKanban, Landmark, MapPin, Scale, ShieldCheck,
  Users2, Workflow, ChevronRight, Gauge, CircleDot, TrendingUp,
} from "lucide-react";

const C = {
  surface: "#FFFFFF", surfaceAlt: "#F8F9F5", surfaceSunk: "#EEF1EB",
  border: "#DDE2D8", borderStrong: "#C9D2C7", ink: "#17231B", inkSoft: "#59635B",
  inkFaint: "#8A938B", primary: "#2F654F", primaryDark: "#183A2C", primaryTint: "#E5EFE8",
  gold: "#8A6A32", goldTint: "#F4EDDD", high: "#B22D25", highTint: "#F9E7E4",
  med: "#9A650D", medTint: "#F8EEDB", low: "#1D7049", lowTint: "#E3F1E8",
};
const FONT_HEAD = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

function Card({ children, style = {}, className = "" }) {
  return <section className={`bd-card rounded-xl ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}`, ...style }}>{children}</section>;
}

function SectionHeading({ eyebrow, title, action, onAction, icon: Icon = Activity, helper }) {
  return <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, textTransform: "uppercase", letterSpacing: .75, fontWeight: 700 }}>
        <Icon size={13} /> {eyebrow}
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 21, color: C.ink, fontWeight: 600, marginTop: 3, lineHeight: 1.15 }}>{title}</div>
      {helper && <div style={{ fontFamily: FONT_BODY, fontSize: 10.2, color: C.inkFaint, marginTop: 5 }}>{helper}</div>}
    </div>
    {action && <button className="bd-action" onClick={onAction} style={{ color: C.primary, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>{action}<ArrowUpRight size={13} /></button>}
  </div>;
}

function RiskPill({ band, score }) {
  const map = {
    high: { bg: C.highTint, color: C.high, label: "High risk" },
    medium: { bg: C.medTint, color: C.med, label: "Medium risk" },
    low: { bg: C.lowTint, color: C.low, label: "Low risk" },
  };
  const m = map[band] || map.low;
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: m.bg, color: m.color, fontFamily: FONT_BODY, fontSize: 10.8, fontWeight: 800, whiteSpace: "nowrap" }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color }} />{m.label} · {score}
  </span>;
}

function Metric({ icon: Icon, label, value, detail, tone = "default", index = 0, onClick }) {
  const tones = {
    default: { bg: C.surface, icon: C.primary, iconBg: C.primaryTint },
    high: { bg: C.highTint, icon: C.high, iconBg: "#F1D0CB" },
    warning: { bg: C.medTint, icon: C.med, iconBg: "#EBDDBF" },
    good: { bg: C.lowTint, icon: C.low, iconBg: "#CDE5D6" },
  };
  const t = tones[tone];
  return <button type="button" onClick={onClick} disabled={!onClick} className="bd-card bd-kpi bd-reveal rounded-xl p-4 text-left w-full" style={{ background: t.bg, border: `1px solid ${tone === "default" ? C.border : "transparent"}`, animationDelay: `${index * 45}ms`, cursor: onClick ? "pointer" : "default" }}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, fontWeight: 700, lineHeight: 1.3 }}>{label}</div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 28, lineHeight: 1.05, color: C.ink, marginTop: 6, fontWeight: 600, letterSpacing: -.4 }}>{value}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 10.3, color: C.inkFaint, marginTop: 6, lineHeight: 1.35 }}>{detail}</div>
      </div>
      <div className="bd-iconbox flex shrink-0 items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: t.iconBg, color: t.icon }}><Icon size={17} /></div>
    </div>
  </button>;
}

function ProgressBar({ value, tone = "primary" }) {
  const fill = tone === "high" ? C.high : tone === "warning" ? C.gold : tone === "good" ? C.low : C.primary;
  return <div className="bd-progress" style={{ height: 7, borderRadius: 999, background: C.surfaceSunk, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, borderRadius: 999, background: fill, transition: "width .45s ease" }} /></div>;
}

function MiniStat({ label, value }) {
  return <div><div style={{ fontFamily: FONT_BODY, fontSize: 9.8, color: C.inkFaint }}>{label}</div><div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink, fontWeight: 800, marginTop: 2 }}>{Number(value).toLocaleString()}</div></div>;
}

function QuickActionRail({ high, alerts, docsMissing, active, setView }) {
  const items = [
    { icon: AlertTriangle, label: "Review high-risk projects", value: high, note: "Projects needing closer review", view: "projects", tone: "high" },
    { icon: Activity, label: "Check open alerts", value: "View", note: "Alerts currently requiring attention", view: "alerts", tone: "warning" },
    { icon: FileCheck2, label: "Review missing documents", value: docsMissing.toLocaleString(), note: "Document signals in active projects", view: "data-health", tone: "default" },
    { icon: FolderKanban, label: "Open project register", value: active, note: "Active projects being monitored", view: "projects", tone: "good" },
    { icon: Database, label: "Open bulk integration", value: "Open", note: "Upload, validate, match and safely promote", view: "data-integration", tone: "default" },
  ];
  return <section className="bd-quick-rail" aria-label="Quick actions">
    <div className="bd-quick-heading">
      <div>
        <div className="bd-quick-eyebrow">Quick actions</div>
        <div className="bd-quick-title">Move from information to action</div>
      </div>
      <div className="bd-quick-helper">Use these shortcuts to open the underlying work.</div>
    </div>
    <div className="bd-quick-grid">
      {items.map(({ icon: Icon, label, value, note, view, tone }) => <button key={label} type="button" className={`bd-quick-card ${tone}`} onClick={() => setView(view)}>
        <span className="bd-quick-icon"><Icon size={17} /></span>
        <span className="bd-quick-copy"><strong>{label}</strong><small>{note}</small></span>
        <span className="bd-quick-value">{value}<ArrowUpRight size={14} /></span>
      </button>)}
    </div>
  </section>;
}

function PortfolioPulse({ projects, active, high, medium, low, approval }) {
  const activePct = projects ? Math.round((active / projects) * 100) : 0;
  const elevated = high + medium;
  const elevatedPct = projects ? Math.round((elevated / projects) * 100) : 0;
  const maxRisk = Math.max(high, medium, low, 1);
  return <div className="bd-portfolio-panel" aria-label="Portfolio overview">
    <div className="bd-portfolio-header">
      <div>
        <div className="bd-portfolio-eyebrow">Portfolio overview</div>
        <div className="bd-portfolio-title">Current project status</div>
        <div className="bd-portfolio-copy">A quick view of activity, risk and approval progress.</div>
      </div>
      <div className="bd-live-chip" title="Current dashboard values are from the connected operational project repository."><span className="bd-status-dot" /> Operational data</div>
    </div>

    <div className="bd-portfolio-stats">
      <div className="bd-portfolio-stat bd-stat-primary"><span>Total projects</span><strong>{projects}</strong><small>All projects in the register</small></div>
      <div className="bd-portfolio-stat"><span>Active projects</span><strong>{active}</strong><small>{activePct}% of the portfolio</small></div>
      <div className="bd-portfolio-stat bd-stat-alert"><span>Need attention</span><strong>{elevated}</strong><small>{elevatedPct}% high or medium risk</small></div>
      <div className="bd-portfolio-stat"><span>Approval progress</span><strong>{approval}%</strong><small>Average across active projects</small></div>
    </div>

    <div className="bd-portfolio-visual">
      <div className="bd-visual-heading"><span>Risk mix</span><span>{projects} projects</span></div>
      <div className="bd-risk-stack" role="img" aria-label={`${high} high risk, ${medium} medium risk, ${low} low risk projects`}>
        <span className="bd-risk-stack-high" style={{ width: `${projects ? high / projects * 100 : 0}%` }} />
        <span className="bd-risk-stack-medium" style={{ width: `${projects ? medium / projects * 100 : 0}%` }} />
        <span className="bd-risk-stack-low" style={{ width: `${projects ? low / projects * 100 : 0}%` }} />
      </div>
      <div className="bd-risk-legend">
        <div><i className="bd-dot-high" /><span>High</span><b>{high}</b></div>
        <div><i className="bd-dot-medium" /><span>Medium</span><b>{medium}</b></div>
        <div><i className="bd-dot-low" /><span>Low</span><b>{low}</b></div>
      </div>
    </div>

    <div className="bd-portfolio-progress">
      <div className="bd-portfolio-progress-row"><span>Active portfolio</span><b>{activePct}%</b></div>
      <div className="bd-thin-track"><span style={{ width: `${activePct}%` }} /></div>
      <div className="bd-portfolio-progress-row bd-progress-secondary"><span>Average approval</span><b>{approval}%</b></div>
      <div className="bd-thin-track"><span style={{ width: `${approval}%` }} /></div>
    </div>
  </div>;
}

function StateRiskChart({ data, onSelect }) {
  return <div className="bd-state-chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 22, top: 4, bottom: 4 }} barCategoryGap={9}>
        <CartesianGrid horizontal={false} stroke={C.border} strokeDasharray="2 4" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontFamily: FONT_BODY, fontSize: 9.5, fill: C.inkFaint }} tickLine={false} axisLine={{ stroke: C.border }} />
        <YAxis type="category" dataKey="state" width={102} tick={{ fontFamily: FONT_BODY, fontSize: 10, fill: C.ink }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#F5F7F3" }} contentStyle={{ fontFamily: FONT_BODY, fontSize: 11, borderRadius: 9, border: `1px solid ${C.border}`, boxShadow: "0 8px 22px rgba(27,35,28,.08)" }} formatter={(value, name, item) => [`${value}/100`, `Average risk · ${item.payload.total} project${item.payload.total === 1 ? "" : "s"}`]} />
        <Bar dataKey="risk" fill={C.primary} radius={[0, 6, 6, 0]} barSize={15} onClick={(entry)=>onSelect?.(entry?.payload||entry)} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export default function DashboardPage({ scored, setView, openProject, role, navigateToProjects, onRefresh }) {
  const [hoverRisk, setHoverRisk] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const states = useMemo(() => [...new Set(scored.map((p) => p.state).filter(Boolean))].sort(), [scored]);
  const portfolio = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scored.filter((p) => {
      const riskOk = riskFilter === "all" || p.risk?.band === riskFilter;
      const statusOk = statusFilter === "all" || p.status === statusFilter;
      const stateOk = stateFilter === "all" || p.state === stateFilter;
      const textOk = !q || [p.name, p.id, p.state, p.district, p.department].filter(Boolean).join(" ").toLowerCase().includes(q);
      return riskOk && statusOk && stateOk && textOk;
    });
  }, [scored, riskFilter, statusFilter, stateFilter, search]);
  const clearFilters = () => { setRiskFilter("all"); setStatusFilter("all"); setStateFilter("all"); setSearch(""); setSelectedRisk(null); };
  const refreshDashboard = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const ongoing = useMemo(() => portfolio.filter((p) => p.status === "ongoing"), [portfolio]);
  const completed = portfolio.length - ongoing.length;
  const high = portfolio.filter((p) => p.risk.band === "high").length;
  const med = portfolio.filter((p) => p.risk.band === "medium").length;
  const low = portfolio.filter((p) => p.risk.band === "low").length;
  const elevated = high + med;
  const parcels = ongoing.reduce((sum, p) => sum + p.parcelsAcquired, 0);
  const families = ongoing.reduce((sum, p) => sum + p.familiesAffected, 0);
  const pendingComp = ongoing.reduce((sum, p) => sum + p.familiesPending, 0);
  const disputes = ongoing.reduce((sum, p) => sum + p.disputes, 0);
  const courtCases = ongoing.reduce((sum, p) => sum + p.courtCases, 0);
  const docsMissing = ongoing.reduce((sum, p) => sum + p.docsMissing, 0);
  const avgDelay = ongoing.length ? Math.round(ongoing.reduce((sum, p) => sum + p.avgDelayDays, 0) / ongoing.length) : 0;
  const acquisitionProgress = ongoing.length ? Math.round(ongoing.reduce((sum, p) => sum + (p.parcelsAcquired / Math.max(1, p.totalParcels)) * 100, 0) / ongoing.length) : 0;
  const avgApproval = ongoing.length ? Math.round(ongoing.reduce((sum, p) => sum + p.approvalPct, 0) / ongoing.length) : 0;
  const topRisk = useMemo(() => [...portfolio].sort((a, b) => b.risk.overall - a.risk.overall).slice(0, 6), [portfolio]);
  const interventionQueue = useMemo(() => [...ongoing].sort((a, b) => (b.risk.overall + b.familiesPending * .05 + b.avgDelayDays * .1) - (a.risk.overall + a.familiesPending * .05 + a.avgDelayDays * .1)).slice(0, 4), [ongoing]);
  const riskData = [{ name: "High", value: high, fill: C.high }, { name: "Medium", value: med, fill: C.med }, { name: "Low", value: low, fill: C.low }];
  const stateRisk = useMemo(() => {
    const map = new Map();
    ongoing.forEach((p) => { const item = map.get(p.state) || { state: p.state, total: 0, risk: 0 }; item.total += 1; item.risk += p.risk.overall; map.set(p.state, item); });
    return [...map.values()].map((x) => ({ ...x, risk: Math.round(x.risk / x.total) })).sort((a, b) => b.risk - a.risk).slice(0, 6);
  }, [ongoing]);
  const coverage = [
    ["Project records", 100, "Project register and stage fields", FolderKanban],
    ["Risk assessments", portfolio.length ? 100 : 0, "Current risk output is available", Gauge],
    ["Compensation signals", ongoing.length ? 100 : 0, "Pending family counts are available", Users2],
    ["Document signals", ongoing.length ? Math.max(0, 100 - Math.min(100, Math.round((docsMissing / Math.max(1, ongoing.length)) * 1.4))) : 0, "Completeness signal from loaded records", FileCheck2],
  ];
  const roleLinks = role === "Administrator" ? [["Access Administration", "admin"]] : role === "Government Officer" ? [["Priority projects", "projects"], ["Risk map", "map"], ["Alerts", "alerts"]] : role === "Department Officer" ? [["Assigned projects", "projects"], ["Officer feedback", "feedback"], ["Bhoomi AI", "chat"]] : role === "Legal Officer" ? [["Legal-risk projects", "projects"], ["History", "history"], ["Bhoomi AI", "chat"]] : [["Dashboard history", "history"], ["Bhoomi AI", "chat"]];

  return <div className="flex flex-col gap-5 bd-dashboard">
    <div className="bd-reveal rounded-xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint, textTransform: "uppercase", letterSpacing: .7, fontWeight: 800 }}>Your workspace</div><div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: C.ink, marginTop: 3 }}>{role || "Authenticated user"} <span style={{ color: C.inkFaint, fontWeight: 500 }}>· your available actions depend on your permissions.</span></div></div>
        <div className="flex flex-wrap gap-2">
          <button className="bd-action" onClick={() => setView("data-integration")} style={{ border: `1px solid ${C.primary}`, background: C.primaryTint, color: C.primaryDark }}><Database size={13}/> Bulk Integration</button>
          <button className="bd-action" onClick={() => setView("map")} style={{ border: `1px solid ${C.border}`, background: C.surfaceSunk, color: C.primary }}>Interactive GIS</button>
          {roleLinks.map(([label, id]) => <button key={id} className="bd-action" onClick={() => setView(id)} style={{ border: `1px solid ${C.border}`, background: C.surfaceSunk, color: C.primary }}>{label}</button>)}
        </div>
      </div>
    </div>

    <section className="bd-hero bd-reveal rounded-2xl" style={{ background: `linear-gradient(132deg, ${C.primaryDark} 0%, ${C.primary} 68%, #3B745C 100%)`, color: "#fff", boxShadow: "0 18px 45px rgba(24,58,44,.15)" }}>
      <div className="bd-orb" />
      <div className="bd-hero-grid">
        <div className="relative z-10 py-2">
          <div className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 10.5, opacity: .78, textTransform: "uppercase", letterSpacing: .8, fontWeight: 800 }}><ShieldCheck size={13} /> BHOOMIDHRISHTI · National Land Acquisition Intelligence</div>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: "clamp(29px,3.2vw,43px)", fontWeight: 600, lineHeight: 1.04, marginTop: 10, letterSpacing: -.7 }}>Identify delays early.<br /><span style={{ opacity: .72 }}>Plan the next action.</span></h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 1.6, maxWidth: 670, marginTop: 12, color: "#ffffffd0" }}>One place to monitor projects, understand delay signals, review evidence and support timely land acquisition decisions.</p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <button className="bd-action" onClick={() => setView("projects")} style={{ background: "#fff", color: C.primaryDark }}>View project register <ArrowUpRight size={14} /></button>
            <button className="bd-action" onClick={() => setView("data-integration")} style={{ background: "#ffffff18", color: "#fff", border: "1px solid #ffffff35" }}><Database size={14}/> Open bulk integration</button>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#ffffff12", border: "1px solid #ffffff22" }}><Activity size={14} /><span style={{ fontFamily: FONT_BODY, fontSize: 10.5 }}>Local portfolio data is loaded</span><span className="bd-status-dot" /></div>
          </div>
        </div>
        <PortfolioPulse projects={scored.length} active={ongoing.length} high={high} medium={med} low={low} approval={avgApproval} />
      </div>
    </section>

    <section className="bd-reveal rounded-xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0"><Filter size={15} color={C.primary}/><div><div style={{fontFamily:FONT_BODY,fontSize:11,fontWeight:800,color:C.ink}}>Interactive portfolio controls</div><div style={{fontFamily:FONT_BODY,fontSize:9.5,color:C.inkFaint}}>{portfolio.length} of {scored.length} projects in view</div></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
          <label style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkSoft,fontWeight:700}}>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Project, district, state…" style={{display:"block",width:"100%",marginTop:4,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px",fontSize:11,color:C.ink,background:C.surfaceAlt}} /></label>
          <label style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkSoft,fontWeight:700}}>Risk<select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} style={{display:"block",width:"100%",marginTop:4,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px",fontSize:11,color:C.ink,background:C.surfaceAlt}}><option value="all">All risk bands</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          <label style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkSoft,fontWeight:700}}>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{display:"block",width:"100%",marginTop:4,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px",fontSize:11,color:C.ink,background:C.surfaceAlt}}><option value="all">All statuses</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></label>
          <label style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkSoft,fontWeight:700}}>State<select value={stateFilter} onChange={e=>setStateFilter(e.target.value)} style={{display:"block",width:"100%",marginTop:4,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px",fontSize:11,color:C.ink,background:C.surfaceAlt}}><option value="all">All states</option>{states.map(st=><option key={st} value={st}>{st}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="bd-action" onClick={clearFilters} style={{border:`1px solid ${C.border}`,background:C.surfaceAlt,color:C.inkSoft}}><RotateCcw size={13}/> Reset</button>
          <button className="bd-action" onClick={refreshDashboard} disabled={refreshing} style={{border:`1px solid ${C.primary}`,background:C.primary,color:"#fff",opacity:refreshing?.7:1}}><RefreshCw size={13} className={refreshing?"animate-spin":""}/> {refreshing?"Refreshing…":"Refresh"}</button>
        </div>
      </div>
    </section>

    <QuickActionRail high={high} docsMissing={docsMissing} active={ongoing.length} setView={setView} />

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric index={0} icon={FolderKanban} label="Projects being monitored" value={scored.length} detail={`${ongoing.length} active · ${completed} completed`} onClick={() => navigateToProjects?.({})} />
      <Metric index={1} icon={AlertTriangle} label="High-risk projects" value={high} detail="Projects needing closer review" tone="high" onClick={() => navigateToProjects?.({risk:"high"})} />
      <Metric index={2} icon={Users2} label="Families awaiting compensation" value={pendingComp.toLocaleString()} detail={`${families.toLocaleString()} affected families across active projects`} tone="warning" onClick={() => setView("operations")} />
      <Metric index={3} icon={Clock3} label="Average compensation delay" value={`${avgDelay}d`} detail="Average delay signal in loaded records" tone={avgDelay > 60 ? "high" : avgDelay > 30 ? "warning" : "good"} onClick={() => setView("history")} />
      <Metric index={4} icon={Landmark} label="Land parcels acquired" value={parcels.toLocaleString()} detail={`${acquisitionProgress}% average acquisition progress`} onClick={() => setView("map")} />
      <Metric index={5} icon={Scale} label="Open disputes / court cases" value={`${disputes} / ${courtCases}`} detail="Signals recorded in active projects" tone={courtCases > 0 ? "warning" : "good"} onClick={() => setView("alerts")} />
      <Metric index={6} icon={FileCheck2} label="Documents needing review" value={docsMissing.toLocaleString()} detail="Missing or incomplete document signals" tone={docsMissing > 30 ? "warning" : "good"} onClick={() => setView("intake")} />
      <Metric index={7} icon={CheckCircle2} label="Average approval progress" value={`${avgApproval}%`} detail="Administrative approval completion" tone={avgApproval < 60 ? "warning" : "good"} onClick={() => setView("history")} />
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Card style={{ padding: 18 }} className="xl:col-span-2">
        <SectionHeading eyebrow="Risk distribution" title="How projects are distributed by risk" action="View projects" onAction={() => setView("projects")} icon={AlertTriangle} helper="Based on the current risk assessment for each project." />
        <div className="bd-risk-layout mt-4">
          <div className="bd-donut-wrap">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" innerRadius={57} outerRadius={80} paddingAngle={4} stroke="none" onClick={(_, index)=>{ const r=riskData[index]||null; setSelectedRisk(r); if(r?.name) navigateToProjects?.({risk:r.name.toLowerCase()}); }} onMouseEnter={(_, index) => setHoverRisk(index)} onMouseLeave={() => setHoverRisk(null)}>{riskData.map((d, i) => <Cell key={d.name} fill={d.fill} opacity={hoverRisk === null || hoverRisk === i ? 1 : .25} />)}</Pie><Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 11, borderRadius: 10, border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(27,35,28,.08)" }} /></PieChart></ResponsiveContainer>
            <div className="bd-donut-center"><strong>{scored.length}</strong><span>total projects</span></div>
          </div>
          <div className="flex flex-col gap-3">
            {riskData.map((d, i) => { const pct = scored.length ? Math.round(d.value / scored.length * 100) : 0; return <button type="button" key={d.name} className="bd-risk-row text-left w-full" onClick={()=>navigateToProjects?.({risk:d.name.toLowerCase()})} onMouseEnter={() => setHoverRisk(i)} onMouseLeave={() => setHoverRisk(null)} style={{ opacity: hoverRisk === null || hoverRisk === i ? 1 : .5 }}>
              <div className="flex items-center justify-between mb-1.5"><span className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 700, color: C.ink }}><span style={{ width: 8, height: 8, borderRadius: 99, background: d.fill }} />{d.name} risk</span><strong style={{ fontFamily: FONT_BODY, fontSize: 12 }}>{d.value}</strong></div>
              <ProgressBar value={pct} tone={d.name === "High" ? "high" : d.name === "Medium" ? "warning" : "good"} />
              <div className="flex items-center justify-between" style={{ fontFamily: FONT_BODY, fontSize: 9.7, color: C.inkFaint, marginTop: 4 }}><span>{pct}% of projects</span><span>{d.value === 1 ? "1 project" : `${d.value} projects`}</span></div>
            </button>; })}
          </div>
        </div>
        <div className="bd-risk-summary">{selectedRisk&&<div className="bd-risk-selected" style={{gridColumn:"1 / -1",padding:"8px 10px",borderRadius:8,background:C.surfaceSunk,border:`1px solid ${C.border}`,fontFamily:FONT_BODY,fontSize:10.8,color:C.inkSoft}}><b style={{color:C.ink}}>{selectedRisk.state ? selectedRisk.name : selectedRisk.name} {selectedRisk.state ? `· average risk ${selectedRisk.risk}/100` : "risk"}</b> · {selectedRisk.value} project{selectedRisk.value===1?"":"s"} ({scored.length?Math.round(selectedRisk.value/scored.length*100):0}%). <button type="button" onClick={()=>setSelectedRisk(null)} style={{marginLeft:8,border:`1px solid ${C.border}`,background:C.surface,borderRadius:5,padding:"3px 7px",fontSize:10,fontWeight:700}}>Clear</button></div>}<div><b>{elevated}</b><span>high or medium risk</span></div><div><b>{low}</b><span>low risk</span></div><div><b>{scored.length ? Math.round(low / scored.length * 100) : 0}%</b><span>low-risk share</span></div></div>
        <div className="mt-3.5 rounded-lg px-3 py-2.5" style={{ background: C.surfaceSunk, color: C.inkSoft, fontFamily: FONT_BODY, fontSize: 10.8, lineHeight: 1.5 }}><b style={{ color: C.ink }}>Please note:</b> risk bands are decision-support signals. They are not legal determinations and should be reviewed with the underlying evidence and applicable rules.</div>
      </Card>

      <Card style={{ padding: 18 }} className="xl:col-span-3">
        <SectionHeading eyebrow="Projects needing attention" title="Current review queue" action="Open operations" onAction={() => setView("operations")} icon={Workflow} helper="A project-level view of the strongest current risk and delay signals." />
        <div className="flex items-center gap-1.5 mt-2" style={{ fontFamily: FONT_BODY, fontSize: 9.8, color: C.inkFaint }}><MapPin size={11} /> Open a project to see its full evidence and timeline.</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3.5">
          {interventionQueue.map((p, i) => <button key={p.id} onClick={() => openProject(p.id)} className="bd-intervention bd-row text-left rounded-xl p-3" style={{ border: `1px solid ${i === 0 ? "#E9C7C2" : C.border}`, background: i === 0 ? C.highTint : C.surface }}>
            <div className="flex items-start gap-2.5"><div className="bd-priority" style={{ background: i === 0 ? C.high : C.primary }}>{String(i + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div style={{ fontFamily: FONT_BODY, fontSize: 12.2, fontWeight: 800, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div><RiskPill band={p.risk.band} score={p.risk.overall} /></div><div style={{ fontFamily: FONT_BODY, fontSize: 10.3, color: C.inkFaint, marginTop: 3 }}>{p.district}, {p.state} · {p.risk.bottleneck.label.replace(" Risk", "")} signal</div></div></div>
            <div className="grid grid-cols-3 gap-2 mt-3"><MiniStat label="Pending compensation" value={p.familiesPending} /><MiniStat label="Disputes" value={p.disputes} /><MiniStat label="Documents missing" value={p.docsMissing} /></div>
            <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: `1px solid ${C.border}` }}><span style={{ fontFamily: FONT_BODY, fontSize: 10.2, color: C.inkSoft }}>Review {p.risk.bottleneck.label.toLowerCase()}</span><ChevronRight size={14} color={C.primary} /></div>
          </button>)}
        </div>
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card style={{ padding: 18 }}>
        <SectionHeading eyebrow="Project risk list" title="Projects with the highest current risk" action="View all" onAction={() => setView("projects")} icon={AlertTriangle} helper="Select a project to inspect the underlying signals." />
        <div className="bd-risk-list mt-3">
          {topRisk.map((p, idx) => <button key={p.id} onClick={() => openProject(p.id)} className="bd-project-row bd-row flex items-center gap-3 text-left" style={{ borderTop: idx === 0 ? "none" : `1px solid ${C.border}` }}>
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 29, height: 29, background: idx < 2 ? C.highTint : C.surfaceSunk, color: idx < 2 ? C.high : C.inkSoft, fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 900 }}>{String(idx + 1).padStart(2, "0")}</div>
            <div className="flex-1 min-w-0"><div style={{ fontFamily: FONT_BODY, fontSize: 12.2, color: C.ink, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div><div style={{ fontFamily: FONT_BODY, fontSize: 10.1, color: C.inkFaint, marginTop: 2 }}>{p.district}, {p.state} · Main signal: {p.risk.bottleneck.label.replace(" Risk", "")}</div></div>
            <RiskPill band={p.risk.band} score={p.risk.overall} /><ArrowUpRight size={13} color={C.inkFaint} className="hidden sm:block" />
          </button>)}
        </div>
      </Card>

      <Card style={{ padding: 18 }}>
        <SectionHeading eyebrow="Average risk by state" title="Where risk is concentrated" action="Open GIS" onAction={() => setView("map")} icon={MapPin} helper="Average risk score across ongoing projects in each state." />
        <div className="bd-chart-caption"><span>Average risk score</span><span>0 — 100</span></div>
        <StateRiskChart data={stateRisk} onSelect={(row)=>{setSelectedRisk({name:row.state,value:row.total,risk:row.risk,state:true}); navigateToProjects?.({state:row.state});}} />
        <div className="bd-chart-footer"><TrendingUp size={12} /><span>Hover over a bar to see the number of ongoing projects behind the average.</span></div>
      </Card>
    </div>

    <Card style={{ padding: 18 }}>
      <SectionHeading eyebrow="Current data coverage" title="What the dashboard can currently show" icon={ShieldCheck} helper="Coverage is calculated from the records loaded into this application." />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        {coverage.map(([label, value, detail, Icon]) => <div key={label} className="bd-coverage rounded-xl p-3.5" style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 11.3, color: C.ink, fontWeight: 800 }}><Icon size={13} color={C.primary} />{label}</span><span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.primary, fontWeight: 900 }}>{value}%</span></div><div className="mt-2.5"><ProgressBar value={value} tone={value < 80 ? "warning" : "primary"} /></div><div style={{ fontFamily: FONT_BODY, fontSize: 10.1, color: C.inkFaint, lineHeight: 1.4, marginTop: 7 }}>{detail}</div></div>)}
      </div>
      <div className="bd-source-note mt-3.5 rounded-xl px-3.5 py-3" style={{ background: C.goldTint, color: C.gold, fontFamily: FONT_BODY, fontSize: 10.7, lineHeight: 1.5 }}><b style={{ color: C.ink }}>Data source note:</b><span style={{ color: C.gold }}> The current local dashboard uses the loaded project dataset. Government-connected data, statutory evidence, parcel geometry and external-source freshness will be shown separately when authorized connectors and records are available.</span></div>
    </Card>
  </div>;
}

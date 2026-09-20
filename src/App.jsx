import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, LineChart, Line, Legend, Cell,
} from "recharts";
import LoginPage from "./components/auth/LoginPage";
import ProjectIntelligencePanel from "./components/project/ProjectIntelligencePanel";
import ProjectOpsPanel from "./components/project/ProjectOpsPanel";
import PredictiveIntelligencePanel from "./components/project/PredictiveIntelligencePanel";
import DataHealthPage from "./components/ops/DataHealthPage";
import DataIntegrationPage from "./components/ops/DataIntegrationPage";
import PredictiveLabPage from "./components/ops/PredictiveLabPage";
import ProjectIntakePage from "./components/intake/ProjectIntakePage";
import RiskMap from "./components/map/RiskMap";
import BhoomiAIPage from "./components/ai/BhoomiAIPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import AdminAccessPage from "./components/admin/AdminAccessPage";
import OperationsCenterPage from "./components/ops/OperationsCenterPage";
import NationalIntelligencePage from "./components/ops/NationalIntelligencePage";
import ProductionReadinessPage from "./components/ops/ProductionReadinessPage";
import IntegrationControlPage from "./components/ops/IntegrationControlPage";
import PublicReviewPage from "./components/public/PublicReviewPage";
import BrandMark from "./components/branding/BrandMark";
import { COPY } from "./content/copy";
import { normaliseDisplayText } from "./utils/text";
import {
  LayoutDashboard, FolderKanban, Map as MapIcon, Bell, BarChart3, MessageSquare,
  ClipboardList, Search, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2,
  X, SlidersHorizontal, LogOut, Scale, FileWarning, Users2, Landmark, Send,
  ArrowUpRight, ArrowDownRight, Building2, ShieldCheck, Plus, UploadCloud, Archive,
  Download, Trash2, FilePlus2, FileCheck2, UserCheck, Clock3, ShieldAlert, MapPin, Link2, ListChecks, Database, Activity as ActivityIcon, Target, BrainCircuit,
} from "lucide-react";

/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const C = {
  bg: "#F4F5F1",
  surface: "#FFFFFF",
  surfaceSunk: "#EEF0EA",
  border: "#DBDFD4",
  borderStrong: "#C4CABB",
  ink: "#1B231C",
  inkSoft: "#586055",
  inkFaint: "#8A9184",
  primary: "#2F5C48",
  primaryDark: "#1E3E30",
  primaryTint: "#E4EDE6",
  gold: "#8A6A32",
  goldTint: "#F3ECDB",
  high: "#AC2B22",
  highTint: "#F8E6E3",
  med: "#95600A",
  medTint: "#F7EDD9",
  low: "#1E6B45",
  lowTint: "#E1F0E6",
};

const FONT_HEAD = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

const FontLoader = () => (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </>
);

/* ============================================================
   SYNTHETIC DATASET
   ============================================================ */
const STAGES = [
  "Land Identification", "Notification", "Survey", "Ownership Verification",
  "Compensation", "Possession", "Resettlement", "Completed",
];

const RAW_PROJECTS = []; // seed data now lives in the persistent backend repository.


/* Approximate schematic map positions per state, used for newly added projects
   (illustrative placement only, not real GIS). Falls back to a random point if
   the state isn't listed. */
const STATE_COORDS = {
  "Tamil Nadu": [46, 82], "Karnataka": [37, 71], "Andhra Pradesh": [55, 66],
  "Telangana": [51, 60], "Maharashtra": [42, 51], "Gujarat": [25, 45],
  "Rajasthan": [30, 31], "Uttar Pradesh": [47, 25], "Odisha": [58, 49],
  "Bihar": [55, 30], "West Bengal": [62, 38], "Kerala": [37, 88],
  "Madhya Pradesh": [42, 42], "Punjab": [35, 15], "Haryana": [40, 18],
  "Delhi": [42, 19], "Chhattisgarh": [50, 44], "Jharkhand": [56, 34],
  "Assam": [70, 25], "Uttarakhand": [43, 14],
};
function coordsForState(state) {
  // Legacy screen-only coordinates retained for non-GIS compatibility.
  // Precise GIS mapping must use latitude/longitude or parcel geometry.
  const base = STATE_COORDS[state];
  return base ? [...base] : null;
}

const CSV_TEMPLATE = `name,code,type,state,district,responsibleDepartment,totalParcels,parcelsAcquired,familiesAffected,familiesPending,avgDelayDays,disputes,courtCases,approvalPct,docsMissing,resettlementPct,rehabPct,depts,prevDelays,stageIndex,status,latitude,longitude
Demo Highway Project,DEMO-SMP-001,Highway,Tamil Nadu,Salem,,200,150,100,25,40,2,1,75,10,80,75,4,1,4,ongoing,11.6643,78.1460
`;

/* ============================================================
   RISK ENGINE ("AI" model — transparent, weighted, explainable)
   ============================================================ */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const WEIGHTS = { compensation: 0.28, legal: 0.20, approval: 0.15, documentation: 0.12, resettlement: 0.15, administrative: 0.10 };

const CATEGORY_LABEL = {
  compensation: "Compensation Risk", legal: "Legal Risk", approval: "Approval Risk",
  documentation: "Documentation Risk", resettlement: "Resettlement Risk", administrative: "Administrative Risk",
};

const DRIVER_TEXT = {
  compensation: (p) => `${p.familiesPending} of ${p.familiesAffected} affected families are still awaiting compensation, with payments overdue by an average of ${p.avgDelayDays} days.`,
  legal: (p) => `${p.disputes} active ownership dispute${p.disputes === 1 ? "" : "s"} and ${p.courtCases} court case${p.courtCases === 1 ? "" : "s"} remain unresolved.`,
  approval: (p) => `Statutory approvals are only ${p.approvalPct}% complete.`,
  documentation: (p) => `${p.docsMissing} required document${p.docsMissing === 1 ? "" : "s"} ${p.docsMissing === 1 ? "is" : "are"} missing or incomplete.`,
  resettlement: (p) => `Resettlement is ${p.resettlementPct}% complete and rehabilitation ${p.rehabPct}% complete.`,
  administrative: (p) => `${p.depts} departments are coordinating this acquisition, with ${p.prevDelays} prior delay${p.prevDelays === 1 ? "" : "s"} on record.`,
};

const ACTIONS = {
  compensation: ["Review all compensation cases pending more than 30 days", "Escalate the highest-value unresolved payments", "Assign a nodal officer to clear the compensation backlog"],
  legal: ["Prioritise high-impact ownership disputes for resolution", "Coordinate with the legal department on active court cases", "Track and publish expected resolution dates"],
  approval: ["Identify which pending approvals are blocking progress", "Set a firm completion date with the approving authority", "Escalate approvals stalled beyond 45 days"],
  documentation: ["Identify all missing documents by category", "Assign a responsible department for each gap", "Set a completion deadline and trigger escalation if missed"],
  resettlement: ["Audit resettlement site readiness against the timeline", "Accelerate rehabilitation entitlement disbursal", "Convene a joint review with the R&R department"],
  administrative: ["Establish a single coordination point across departments", "Review causes of prior delays before they recur", "Set a weekly inter-departmental sync for this project"],
};

function computeRisk(p) {
  const compDays = clamp(p.avgDelayDays / 90, 0, 1);
  const compFam = p.familiesAffected ? clamp(p.familiesPending / p.familiesAffected, 0, 1) : 0;
  const compensation = Math.round(100 * (0.6 * compDays + 0.4 * compFam));

  const disputeS = clamp(p.disputes / 8, 0, 1);
  const courtS = clamp(p.courtCases / 5, 0, 1);
  const legal = Math.round(100 * (0.55 * disputeS + 0.45 * courtS));

  const approval = Math.round(clamp(100 - p.approvalPct, 0, 100));
  const documentation = Math.round(100 * clamp(p.docsMissing / 40, 0, 1));
  const resettlement = Math.round(0.5 * clamp(100 - p.resettlementPct, 0, 100) + 0.5 * clamp(100 - p.rehabPct, 0, 100));

  const deptS = clamp((p.depts - 2) / 6, 0, 1);
  const prevS = clamp(p.prevDelays / 3, 0, 1);
  const administrative = Math.round(100 * (0.5 * deptS + 0.5 * prevS));

  const categories = { compensation, legal, approval, documentation, resettlement, administrative };
  const overall = Math.round(Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * categories[k], 0));
  const band = overall >= 65 ? "high" : overall >= 40 ? "medium" : "low";

  const drivers = Object.keys(categories)
    .map((k) => ({ key: k, label: CATEGORY_LABEL[k], value: categories[k], contribution: WEIGHTS[k] * categories[k], text: DRIVER_TEXT[k](p) }))
    .sort((a, b) => b.contribution - a.contribution);

  const bottleneck = drivers[0];
  const second = drivers[1];
  const explanation = band === "low"
    ? `This project is progressing on track. ${bottleneck.label.replace(" Risk", "")} is the only area worth monitoring, currently at ${bottleneck.value}/100.`
    : `This project has a ${band === "high" ? "high" : "moderate"} probability of delay, driven mainly by ${bottleneck.label.toLowerCase()} and ${second.label.toLowerCase()}. ${bottleneck.text}`;

  const recommendedActions = drivers.filter((d) => d.value >= 45).slice(0, 3).flatMap((d) => ACTIONS[d.key].slice(0, 2));

  return { overall, band, categories, drivers, bottleneck, explanation, recommendedActions: recommendedActions.length ? recommendedActions : ["Continue routine monitoring — no urgent action required."] };
}

function riskTrend(overall) {
  const factors = [0.58, 0.68, 0.76, 0.84, 0.92, 1];
  return factors.map((f, i) => ({ step: `A${i + 1}`, risk: Math.max(4, Math.round(overall * f)) }));
}

const bandColor = (band) => (band === "high" ? C.high : band === "medium" ? C.med : C.low);
const bandTint = (band) => (band === "high" ? C.highTint : band === "medium" ? C.medTint : C.low && C.lowTint);
const bandLabel = (band) => (band === "high" ? "High risk" : band === "medium" ? "Medium risk" : "Low risk");

/* ============================================================
   SMALL UI ATOMS
   ============================================================ */
function RiskDot({ band, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: bandColor(band), display: "inline-block", flexShrink: 0 }} />;
}

function RiskPill({ band, score }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded"
      style={{ background: bandTint(band), color: bandColor(band), fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, border: `1px solid ${bandColor(band)}33` }}
    >
      <RiskDot band={band} size={6} />
      {bandLabel(band)}{typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

function Card({ children, style, className = "" }) {
  return (
    <div className={`rounded-md ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, right }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {eyebrow && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint, marginBottom: 2 }}>{eyebrow}</div>}
        <h2 style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 600, color: C.ink }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function KpiCard({ label, value, sub, trend }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{label}</div>
      <div className="flex items-end gap-2 mt-1">
        <div style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{value}</div>
        {trend && (
          <span className="flex items-center gap-0.5 mb-0.5" style={{ fontSize: 12, color: trend > 0 ? C.high : C.low, fontFamily: FONT_BODY }}>
            {trend > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

const getNavIcon = (item) => item.icon;

function Btn({ children, onClick, variant = "primary", small, icon: Icon, disabled }) {
  const styles = {
    primary: { background: disabled ? C.inkFaint : C.primary, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.border}` },
    subtle: { background: C.surfaceSunk, color: C.ink, border: `1px solid ${C.border}` },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded"
      style={{ ...styles[variant], padding: small ? "5px 10px" : "8px 14px", fontFamily: FONT_BODY, fontSize: small ? 12.5 : 13.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}
    >
      {Icon && <Icon size={small ? 13 : 15} />}
      {children}
    </button>
  );
}

/* ============================================================
   GLOBAL COMMAND PALETTE / WORKSPACE NAVIGATION
   ============================================================ */
function CommandPalette({ open, onClose, setView, projects, openProject, alertCount, permissions=[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const navItems = NAV.filter((n) => !n.permission || permissions.includes("*") || permissions.includes(n.permission)).map((n) => ({ kind: "nav", id: n.id, label: n.label, icon: getNavIcon(n) }));
  const q = query.trim().toLowerCase();
  const matchingNav = navItems.filter((n) => !q || n.label.toLowerCase().includes(q));
  const matchingProjects = projects.filter((p) => !q || `${p.name} ${p.code} ${p.district} ${p.state}`.toLowerCase().includes(q)).slice(0, 7);
  const go = (item) => { onClose(); if (item.kind === "project") openProject(item.id); else setView(item.id); };
  return (
    <div className="bd-command-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bd-command" role="dialog" aria-modal="true" aria-label="Quick navigation">
        <div className="bd-command-search"><Search size={17} /><input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages or projects…" aria-label="Search pages or projects" /><kbd>Esc</kbd><button onClick={onClose} aria-label="Close search"><X size={16}/></button></div>
        <div className="bd-command-body">
          {!q && <div className="bd-command-section"><div className="bd-command-label">Quick navigation</div><div className="bd-command-grid">{matchingNav.slice(0,8).map((n) => <button key={n.id} className="bd-command-item" onClick={() => go(n)}><span className="bd-command-icon"><n.icon size={15}/></span><span>{n.label}</span>{n.id === "alerts" && alertCount > 0 && <b>{alertCount}</b>}</button>)}</div></div>}
          {(q || matchingProjects.length) && <div className="bd-command-section"><div className="bd-command-label">Projects</div>{matchingProjects.length ? matchingProjects.map((p) => <button key={p.id} className="bd-command-project" onClick={() => go({kind:"project",id:p.id})}><span className="bd-command-project-dot" style={{background: bandColor(p.risk?.band || "low")}}/><span className="min-w-0 flex-1"><strong>{p.name}</strong><small>{p.code} · {p.district}, {p.state}</small></span><RiskPill band={p.risk?.band || "low"} score={p.risk?.overall}/></button>) : <div className="bd-command-empty">No matching projects.</div>}</div>}
        </div>
        <div className="bd-command-footer"><span><kbd>Ctrl</kbd><kbd>K</kbd> Search</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR / SHELL
   ============================================================ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "add", label: "Add Project", icon: Plus },
  { id: "intake", label: "Project Intake", icon: UploadCloud, permission: "projects:edit" },
  { id: "map", label: "Risk Map", icon: MapIcon },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "operations", label: "Operations Center", icon: ActivityIcon },
  { id: "national-intelligence", label: "National Intelligence", icon: Target, permission: "dashboard:read" },
  { id: "predictive-lab", label: "Predictive Lab", icon: BrainCircuit, permission: "risk:read" },
  { id: "history", label: "Historical Analysis", icon: BarChart3 },
  { id: "feedback", label: "Officer Feedback", icon: ClipboardList },
  { id: "chat", label: "Bhoomi AI", icon: MessageSquare },
  { id: "data-integration", label: "Data Integration", icon: Database, permission: "dashboard:read" },
  { id: "data-health", label: "Data Health", icon: Database, permission: "dashboard:read" },
  { id: "readiness", label: "System Readiness", icon: ShieldCheck, permission: "dashboard:read" },
  { id: "integrations", label: "Integration Control", icon: Link2, permission: "dashboard:read" },
  { id: "admin", label: "Access Administration", icon: ShieldCheck, permission: "admin:access" },
  { id: "public-review", label: "Public Review", icon: ClipboardList, publicDemo: true },
];

function Sidebar({ view, setView, role, permissions = [], onLogout, alertCount, publicDemo = false }) {
  return (
    <div className="flex flex-col justify-between h-full" style={{ width: 228, background: C.primaryDark, flexShrink: 0 }}>
      <div>
        <div className="flex items-center gap-2 px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #ffffff22" }}>
          <div className="flex items-center justify-center rounded" style={{ width: 30, height: 30, background: C.gold }}>
            <Landmark size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 15.5, color: "#fff", fontWeight: 600, lineHeight: 1.1 }}>BhoomiDrishti</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: "#ffffff99", letterSpacing: 0.2, lineHeight: 1.25 }}>Land Acquisition<br />Decision Support System</div>
          </div>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {NAV.filter((n) => (!n.permission || permissions.includes("*") || permissions.includes(n.permission)) && (!n.publicDemo || publicDemo)).map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className="flex items-center justify-between px-3 py-2 rounded text-left"
                style={{ background: active ? "#ffffff1a" : "transparent", color: active ? "#fff" : "#ffffffb0", fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: active ? 600 : 500 }}
              >
                <span className="flex items-center gap-2.5"><Icon size={16} />{n.label}</span>
                {n.id === "alerts" && alertCount > 0 && (
                  <span style={{ background: C.high, color: "#fff", fontSize: 10.5, borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>{alertCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="px-4 pb-5">
        <div className="flex items-center gap-2 px-2 py-2 rounded" style={{ background: "#ffffff12" }}>
          <div className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: C.gold, color: "#fff", fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {role.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: "#ffffff90" }}>Authenticated session</div>
          </div>
          <button onClick={onLogout} title="Switch role"><LogOut size={14} color="#ffffffb0" /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LOGIN
   ============================================================ */
const ROLES = [
  { id: "Administrator", desc: "Full administration and configuration access." },
  { id: "Government Officer", desc: "Government project oversight, actions and escalations." },
  { id: "Department Officer", desc: "Assigned departmental and operational work." },
  { id: "Legal Officer", desc: "Legal and dispute review and evidence inspection." },
  { id: "Viewer", desc: "Read-only dashboards and reports." },
];

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ scored, setView, openProject, role, navigateToProjects }) {
  return <DashboardPage scored={scored} setView={setView} openProject={openProject} role={role} navigateToProjects={navigateToProjects} />;
}

/* ============================================================
   PROJECTS TABLE
   ============================================================ */
function ProjectsPage({ scored, openProject, openProjectAI, onArchiveProject, canManageProjects, initialFilters }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("risk");
  const [sortDir, setSortDir] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  useEffect(() => {
    if (!initialFilters) return;
    if (initialFilters.risk) setRiskFilter(initialFilters.risk);
    if (initialFilters.state) setStateFilter(initialFilters.state);
    if (initialFilters.type) setTypeFilter(initialFilters.type);
    if (initialFilters.status) setStatusFilter(initialFilters.status);
    if (initialFilters.department) setDepartmentFilter(initialFilters.department);
    if (initialFilters.stage !== undefined && initialFilters.stage !== null) setStageFilter(String(initialFilters.stage));
    if (initialFilters.search) setSearch(initialFilters.search);
  }, [initialFilters]);

  const loadArchived = async () => {
    setArchiveLoading(true); setArchiveError("");
    try { const r=await fetch("/api/projects-archived",{credentials:"include",headers:{Accept:"application/json"}}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.error||"Unable to load archived projects."); setArchivedProjects(Array.isArray(b?.projects)?b.projects:[]); }
    catch(e){ setArchiveError(e?.message||"Unable to load archived projects."); } finally { setArchiveLoading(false); }
  };
  const restoreArchived = async (project) => {
    if(!window.confirm(`Restore \"${String(project?.name||"this project").replaceAll('\"','\\\"')}\" to the active portfolio?`)) return;
    setArchiveLoading(true); setArchiveError("");
    try { const r=await fetch(`/api/projects/${encodeURIComponent(project.id)}/restore`,{method:"POST",credentials:"include",headers:{Accept:"application/json"}}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.error||"Unable to restore project."); setArchivedProjects(v=>v.filter(x=>x.id!==project.id)); }
    catch(e){ setArchiveError(e?.message||"Unable to restore project."); } finally { setArchiveLoading(false); }
  };
  const states = useMemo(() => ["all", ...new Set(scored.map((p) => p.state))], [scored]);
  const types = useMemo(() => ["all", ...new Set(scored.map((p) => p.type))], [scored]);
  const departments = useMemo(() => ["all", ...new Set(scored.map((p) => p.responsibleDepartment).filter(Boolean))], [scored]);
  const stages = useMemo(() => ["all", ...new Set(scored.map((p) => String(p.stageIndex ?? "")).filter(Boolean))].sort((a,b)=>a==='all'?-1:b==='all'?1:Number(a)-Number(b)), [scored]);

  const filtered = useMemo(() => {
    let r = scored.filter((p) =>
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.district.toLowerCase().includes(search.toLowerCase())) &&
      (riskFilter === "all" || p.risk.band === riskFilter) &&
      (stateFilter === "all" || p.state === stateFilter) &&
      (typeFilter === "all" || p.type === typeFilter) &&
      (statusFilter === "all" || p.status === statusFilter) &&
      (departmentFilter === "all" || p.responsibleDepartment === departmentFilter) &&
      (stageFilter === "all" || String(p.stageIndex ?? "") === stageFilter)
    );
    r.sort((a, b) => {
      let av, bv;
      if (sortKey === "risk") { av = a.risk.overall; bv = b.risk.overall; }
      else if (sortKey === "progress") { av = a.parcelsAcquired / a.totalParcels; bv = b.parcelsAcquired / b.totalParcels; }
      else if (sortKey === "name") { av = a.name; bv = b.name; }
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return r;
  }, [scored, search, riskFilter, stateFilter, typeFilter, statusFilter, departmentFilter, stageFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const selectStyle = { fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap"><SectionTitle eyebrow={`${filtered.length} of ${scored.length} projects`} title="Project risk register" />{canManageProjects&&<button onClick={()=>{setArchiveOpen(v=>!v);if(!archiveOpen)loadArchived();}} className="inline-flex items-center gap-1.5 rounded px-3 py-2" style={{border:`1px solid ${C.border}`,background:C.surface,color:C.inkSoft,fontFamily:FONT_BODY,fontSize:11.5,fontWeight:800}}><Archive size={13}/>{archiveOpen?'Close archive':'Portfolio archive'}</button>}</div>
      {archiveOpen&&canManageProjects&&<Card style={{padding:14,background:C.surfaceSunk}}><div className="flex items-center justify-between gap-3"><div><div style={{fontFamily:FONT_BODY,fontSize:13,fontWeight:800,color:C.ink}}>Recoverable portfolio archive</div><div style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint,marginTop:2}}>Removed projects stay preserved with evidence/history. Restore is limited by the same authority scope.</div></div><Btn small variant="ghost" onClick={loadArchived} disabled={archiveLoading}>Refresh</Btn></div>{archiveError&&<div className="mt-2 rounded px-3 py-2" style={{background:C.highTint,color:C.high,fontFamily:FONT_BODY,fontSize:10.8}}>{archiveError}</div>}{archiveLoading?<div className="mt-3" style={{fontFamily:FONT_BODY,fontSize:11,color:C.inkFaint}}>Loading archive…</div>:archivedProjects.length===0?<div className="mt-3" style={{fontFamily:FONT_BODY,fontSize:11,color:C.inkFaint}}>No archived projects in your authorised scope.</div>:<div className="mt-3 flex flex-col gap-1.5">{archivedProjects.map(p=><div key={p.id} className="flex items-center justify-between gap-3 rounded px-3 py-2" style={{background:C.surface,border:`1px solid ${C.border}`}}><div><div style={{fontFamily:FONT_BODY,fontSize:11.5,fontWeight:800,color:C.ink}}>{p.name}</div><div style={{fontFamily:FONT_BODY,fontSize:9.8,color:C.inkFaint}}>{p.code} · {p.district}, {p.state} · {p.archivedAt?new Date(p.archivedAt).toLocaleString():''}</div><div style={{fontFamily:FONT_BODY,fontSize:9.8,color:C.inkSoft,marginTop:2}}>Reason: {p.archiveReason||'Not recorded'}</div></div><Btn small variant="subtle" onClick={()=>restoreArchived(p)} disabled={archiveLoading}>Restore</Btn></div>)}</div>}</Card>}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 rounded" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
          <Search size={14} color={C.inkFaint} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project or district" style={{ border: "none", outline: "none", padding: "7px 4px", fontFamily: FONT_BODY, fontSize: 12.5, width: 210, background: "transparent" }} />
        </div>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={selectStyle}>
          <option value="all">All risk levels</option>
          <option value="high">High risk</option>
          <option value="medium">Medium risk</option>
          <option value="low">Low risk</option>
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
          {states.map((s) => <option key={s} value={s}>{s === "all" ? "All states" : s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          {types.map((t) => <option key={t} value={t}>{t === "all" ? "All project types" : t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option>
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={selectStyle}>
          {departments.map((d) => <option key={d} value={d}>{d === "all" ? "All departments" : d}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={selectStyle}>
          {stages.map((s) => <option key={s} value={s}>{s === "all" ? "All stages" : `Stage ${Number(s)+1}`}</option>)}
        </select>
      </div>

      <Card>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {[["name", "Project"], ["district", "Location"], ["progress", "Progress"], ["risk", "Risk"], [null, "Predicted Bottleneck"], [null, "Action"]].map(([key, label]) => (
                <th key={label} onClick={() => key && toggleSort(key)} className="text-left px-4 py-2.5" style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, fontWeight: 600, cursor: key ? "pointer" : "default", whiteSpace: "nowrap" }}>
                  {label}{sortKey === key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pct = Math.round((p.parcelsAcquired / p.totalParcels) * 100);
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="px-4 py-2.5" style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink, fontWeight: 600, maxWidth: 240 }}>{p.name}<div style={{ fontSize: 11, color: C.inkFaint, fontWeight: 400 }}>{p.code} · {p.type}{p.responsibleDepartment ? ` · ${p.responsibleDepartment}` : ""}</div></td>
                  <td className="px-4 py-2.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{p.district}, {p.state}</td>
                  <td className="px-4 py-2.5" style={{ width: 130 }}>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full" style={{ width: 60, height: 5, background: C.surfaceSunk, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: C.primary }} />
                      </div>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><RiskPill band={p.risk.band} score={p.risk.overall} /></td>
                  <td className="px-4 py-2.5" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{p.status === "completed" ? "—" : p.risk.bottleneck.label.replace(" Risk", "")}</td>
                  <td className="px-4 py-2.5"><div className="flex gap-1.5"><Btn small variant="ghost" onClick={() => openProject(p.id)}>View</Btn><button onClick={() => openProjectAI(p.id)} className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ border:`1px solid ${C.primary}44`, background:C.primaryTint, color:C.primary, fontFamily:FONT_BODY, fontSize:10.8, fontWeight:800 }} title="Ask Bhoomi AI about this project"><MessageSquare size={12}/>AI</button>{canManageProjects&&<button onClick={() => onArchiveProject?.(p)} className="inline-flex items-center gap-1 rounded px-2 py-1" style={{ border:`1px solid ${C.high}44`, background:C.highTint, color:C.high, fontFamily:FONT_BODY, fontSize:10.8, fontWeight:800 }} title="Remove from active portfolio"><Trash2 size={12}/>Remove</button>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ============================================================
   PROJECT DETAIL (incl. Explainable AI + What-If)
   ============================================================ */

const REQUIRED_DOCUMENTS = [
  { key: 'notification', label: 'Acquisition / statutory notification', owner: 'Land Acquisition Officer / Records Cell', evidence: 'Applicable notification and publication record' },
  { key: 'landRecord', label: 'Record of Rights / land-record extract', owner: 'Revenue / Land Records Officer', evidence: 'Current RoR or equivalent authoritative land record' },
  { key: 'survey', label: 'Survey / cadastral reference', owner: 'Survey / Records Officer', evidence: 'Survey numbers and approved spatial reference' },
  { key: 'ownership', label: 'Ownership / title verification', owner: 'Revenue / Land Acquisition Officer', evidence: 'Ownership and encumbrance verification record' },
  { key: 'compensation', label: 'Compensation assessment / payment record', owner: 'Compensation / Accounts Cell', evidence: 'Award, calculation and payment status' },
  { key: 'rr', label: 'Rehabilitation & resettlement record', owner: 'R&R Nodal Officer', evidence: 'Eligible families, entitlements and progress' },
  { key: 'legal', label: 'Court / dispute record where applicable', owner: 'Legal Officer', evidence: 'Case reference, latest order and status' },
];

function buildDocumentChecks(project) {
  const total = Math.max(0, Number(project.docsMissing) || 0);
  const severe = project.approvalPct < 55 || total >= 30;
  const medium = project.approvalPct < 80 || total >= 10;
  const statuses = {
    notification: project.stageIndex >= 1 ? 'available' : 'pending',
    landRecord: project.disputes > 0 ? 'review' : 'available',
    survey: project.parcelsAcquired < project.totalParcels ? 'review' : 'available',
    ownership: project.disputes > 0 ? 'review' : 'available',
    compensation: project.familiesPending > 0 ? 'review' : 'available',
    rr: project.resettlementPct < 70 || project.rehabPct < 70 ? 'review' : 'available',
    legal: project.courtCases > 0 ? 'review' : 'not-required',
  };
  if (severe) statuses.notification = project.stageIndex < 2 ? 'pending' : statuses.notification;
  if (medium && total > 0) statuses.survey = 'review';
  return REQUIRED_DOCUMENTS.map((d) => ({ ...d, status: statuses[d.key] }));
}

function buildOfficerChecks(project) {
  return [
    { level: 'Project / Acquisition', role: 'Land Acquisition Officer', checkpoint: 'Current stage & project record', status: project.approvalPct >= 80 ? 'verified' : 'attention', note: project.approvalPct >= 80 ? 'Approval progress is relatively strong.' : 'Approval progress indicates officer review is required.' },
    { level: 'Revenue / Records', role: 'Revenue / Land Records Officer', checkpoint: 'Land-record and ownership verification', status: project.disputes > 0 ? 'attention' : 'verified', note: project.disputes > 0 ? `${project.disputes} ownership dispute(s) require resolution tracking.` : 'No ownership disputes reported in the current dataset.' },
    { level: 'Compensation', role: 'Compensation / Accounts Cell', checkpoint: 'Payment backlog', status: project.familiesPending > 0 ? 'attention' : 'verified', note: project.familiesPending > 0 ? `${project.familiesPending} family payment record(s) remain pending.` : 'No pending family payments reported.' },
    { level: 'Legal', role: 'Legal Officer', checkpoint: 'Court / dispute status', status: project.courtCases > 0 ? 'attention' : 'verified', note: project.courtCases > 0 ? `${project.courtCases} court case(s) require current-order verification.` : 'No court cases reported in the current dataset.' },
    { level: 'R&R', role: 'R&R Nodal Officer', checkpoint: 'Resettlement / rehabilitation progress', status: project.resettlementPct < 80 || project.rehabPct < 80 ? 'attention' : 'verified', note: `R&R ${project.resettlementPct}% · rehabilitation ${project.rehabPct}%.` },
    { level: 'District / State review', role: 'Supervisory / Nodal Officer', checkpoint: 'Escalation and inter-department coordination', status: project.depts >= 7 || project.prevDelays >= 2 ? 'attention' : 'verified', note: `${project.depts} departments involved; ${project.prevDelays} prior delay event(s) recorded.` },
  ];
}

function StatusTag({ status }) {
  const map = {
    available: ['Available', C.low, C.lowTint],
    verified: ['Verified', C.low, C.lowTint],
    review: ['Review required', C.med, C.medTint],
    attention: ['Action required', C.high, C.highTint],
    pending: ['Pending', C.med, C.medTint],
    'not-required': ['Not flagged', C.inkFaint, C.surfaceSunk],
  };
  const [label, color, bg] = map[status] || ['Unknown', C.inkFaint, C.surfaceSunk];
  return <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700, color, background: bg, border: `1px solid ${color}33`, borderRadius: 999, padding: '3px 7px' }}>{label}</span>;
}

function ProjectEvidencePanel({ project }) {
  const docs = buildDocumentChecks(project);
  const officers = buildOfficerChecks(project);
  const missingCount = Math.max(0, Number(project.docsMissing) || 0);
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card style={{ padding: 18 }}>
        <SectionTitle title="Document & evidence readiness" eyebrow="Operational verification" />
        <div className="rounded-md px-3 py-2.5 mb-3" style={{ background: C.goldTint, border: `1px solid ${C.gold}33` }}>
          <div className="flex items-center gap-2"><FileCheck2 size={15} color={C.gold} /><span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, fontWeight: 700 }}>{missingCount} missing / incomplete document record{missingCount === 1 ? '' : 's'} reported</span></div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 3 }}>Category-level triage below is derived from the current dataset. The authoritative checklist must be configured from the applicable statute, state process and source record.</div>
        </div>
        <div className="flex flex-col gap-2">
          {docs.map((d) => <div key={d.key} className="px-3 py-2.5 rounded" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between gap-2"><div className="flex items-start gap-2"><FileWarning size={14} color={d.status === 'review' || d.status === 'pending' ? C.med : C.primary} style={{ marginTop: 2 }} /><div><div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.ink }}>{d.label}</div><div style={{ fontFamily: FONT_BODY, fontSize: 10.8, color: C.inkSoft, marginTop: 2 }}>Responsible: {d.owner}</div><div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, marginTop: 1 }}>Evidence: {d.evidence}</div></div></div><StatusTag status={d.status} /></div>
          </div>)}
        </div>
      </Card>
      <Card style={{ padding: 18 }}>
        <SectionTitle title="Officer verification matrix" eyebrow="Who needs to check or approve" />
        <div className="flex flex-col gap-2">
          {officers.map((o) => <div key={o.level} className="rounded px-3 py-2.5" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            <div className="flex items-start justify-between gap-2"><div className="flex items-start gap-2"><UserCheck size={14} color={o.status === 'attention' ? C.high : C.primary} style={{ marginTop: 2 }} /><div><div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint }}>{o.level}</div><div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ink, fontWeight: 700 }}>{o.role}</div><div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>Checkpoint: {o.checkpoint}</div></div></div><StatusTag status={o.status} /></div>
            <div style={{ marginTop: 6, paddingLeft: 22, fontFamily: FONT_BODY, fontSize: 10.8, color: C.inkFaint }}>{o.note}</div>
          </div>)}
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}><div className="flex items-center gap-2" style={{ fontFamily: FONT_BODY, fontSize: 10.8, color: C.inkFaint }}><ShieldAlert size={14} color={C.gold} /> Officer names, designations and approval status must come from authorized workflow data; the demo does not invent named government officials.</div></div>
      </Card>
    </div>
  );
}

function ProjectLocationPanel({ project, user, onSaved }) {
  const canEdit = Array.isArray(user?.permissions) && (user.permissions.includes('*') || user.permissions.includes('projects:edit'));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingLocation, setPendingLocation] = useState(null);
  const currentPrecision = project?.locationPrecision || 'UNRESOLVED';
  const currentLabel = project?.locationLabel || 'No verified project-level location label is stored.';

  const search = async () => {
    const q = query.trim() || [project?.district, project?.state, 'India'].filter(Boolean).join(', ');
    if (!q || searching) return;
    setSearching(true); setMessage(''); setResults([]);
    try {
      const r = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { credentials:'include', headers:{Accept:'application/json'} });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Location search failed.');
      setResults(Array.isArray(body?.results) ? body.results : []);
      if (!body?.results?.length) setMessage('No geocoded results returned. Enter a more specific locality, road, village or coordinate.');
    } catch(e) { setMessage(e?.message || 'Location search failed.'); }
    finally { setSearching(false); }
  };

  const save = async (r, force=false) => {
    if (!canEdit || saving) return;
    const projectDistrict=String(project?.district||'').trim().toLowerCase();
    const projectState=String(project?.state||'').trim().toLowerCase();
    const resultDistrict=String(r?.address?.district||'').trim().toLowerCase();
    const resultState=String(r?.address?.state||'').trim().toLowerCase();
    const districtMismatch=Boolean(resultDistrict && projectDistrict && !resultDistrict.includes(projectDistrict) && !projectDistrict.includes(resultDistrict));
    const stateMismatch=Boolean(resultState && projectState && !resultState.includes(projectState) && !projectState.includes(resultState));
    if(!force && (districtMismatch||stateMismatch)){ setPendingLocation({r,districtMismatch,stateMismatch}); setMessage('Geocoder result does not clearly match the project district/state. Review it before saving.'); return; }
    setPendingLocation(null);
    setSaving(true); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/location`, {
        method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({
          latitude:Number(r.lat), longitude:Number(r.lon), locationPrecision:'GEOCODED_PLACE',
          locationSource:'NOMINATIM_OSM', locationLabel:r.displayName||'', locationOsmType:r.osmType||null,
          locationOsmId:r.osmId??null, locationBBox:r.boundingBox||null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Project location could not be saved.');
      setResults([]);
      setMessage('Location saved to the persistent project repository.');
      onSaved?.(body.project || project);
    } catch(e) { setMessage(e?.message || 'Project location could not be saved.'); }
    finally { setSaving(false); }
  };

  return <Card style={{padding:18}}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <SectionTitle title="Project location" eyebrow="GIS provenance & precision" />
        <div style={{fontFamily:FONT_BODY,fontSize:11.5,color:C.inkSoft,marginTop:2}}>{currentPrecision.replaceAll('_',' ')} · {currentLabel}</div>
        {project?.latitude != null && project?.longitude != null && <div style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint,marginTop:3}}>Stored coordinate: {Number(project.latitude).toFixed(6)}, {Number(project.longitude).toFixed(6)}</div>}
      </div>
      {!canEdit && <span style={{fontFamily:FONT_BODY,fontSize:10.5,color:C.inkFaint}}>Read-only</span>}
    </div>
    {canEdit && <>
      <div className="flex gap-2 mt-3"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')search();}} placeholder="Search road, village, city, district or corridor" style={{...inputStyleShared,flex:1}}/><button onClick={search} disabled={searching} style={{border:`1px solid ${C.border}`,background:C.surface,borderRadius:5,padding:'7px 10px',fontFamily:FONT_BODY,fontSize:11.5,fontWeight:700,color:C.primary}}>{searching?'Searching…':'Find location'}</button></div>
      {results.length>0 && <div className="flex flex-col gap-1.5 mt-2">{results.map((r,i)=><button key={`${r.osmType}-${r.osmId}-${i}`} onClick={()=>save(r)} disabled={saving} className="text-left rounded px-3 py-2" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT_BODY,fontSize:11.5,fontWeight:700,color:C.ink}}>{r.displayName}</div><div style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkFaint,marginTop:2}}>Lat {Number(r.lat).toFixed(6)} · Lon {Number(r.lon).toFixed(6)} · {r.osmType||'OSM'} {r.osmId??''}</div></button>)}</div>}
      {pendingLocation && <div className="mt-2 rounded px-3 py-2" style={{background:C.highTint,border:`1px solid ${C.high}`}}><div style={{fontFamily:FONT_BODY,fontSize:10.8,color:C.ink,fontWeight:700}}>Review location mismatch</div><div style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkFaint,marginTop:3}}>{pendingLocation.r.displayName}</div><button onClick={()=>save(pendingLocation.r,true)} disabled={saving} style={{marginTop:7,border:0,borderRadius:5,padding:'6px 9px',background:C.high,color:'#fff',fontFamily:FONT_BODY,fontSize:10.5,fontWeight:700}}>Confirm location anyway</button></div>}
      <div style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkFaint,marginTop:8}}>Use authorized parcel geometry for cadastral precision. A place geocode is a project point, not a parcel boundary.</div>
    </>}
    {message && <div style={{fontFamily:FONT_BODY,fontSize:10.8,color:message.toLowerCase().includes('failed')||message.toLowerCase().includes('could not')?C.high:C.primary,marginTop:8}}>{message}</div>}
  </Card>;
}

const inputStyleShared = { fontFamily: FONT_BODY, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 5, padding: '7px 9px', width:'100%', background:C.surface };

function ProjectDetail({ project, onBack, onAskAI, onOpenMap, user, onLocationSaved }) {
  const [sim, setSim] = useState(null);
  const [exportingEvidence, setExportingEvidence] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [scenarioPreview, setScenarioPreview] = useState(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState('');

  const downloadEvidencePack = async () => {
    setExportingEvidence(true);
    setExportMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/evidence-pack`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Evidence pack export failed.');
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bhoomidrishti-${String(project.code || project.id).replace(/[^A-Za-z0-9._-]+/g, '_')}-evidence-pack.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage('Evidence pack exported.');
    } catch (error) {
      setExportMessage(error?.message || 'Evidence pack export failed.');
    } finally {
      setExportingEvidence(false);
    }
  };

  useEffect(() => { setSim(null); }, [project.id]);

  const base = computeRisk(project);
  const simProject = sim ? { ...project, ...sim } : project;
  const simRisk = sim ? computeRisk(simProject) : base;
  const delta = simRisk.overall - base.overall;

  const radarData = Object.keys(base.categories).map((k) => ({ subject: CATEGORY_LABEL[k].replace(" Risk", ""), value: base.categories[k] }));
  const trend = riskTrend(base.overall);
  const pct = Math.round((project.parcelsAcquired / project.totalParcels) * 100);

  const resetSim = () => { setSim(null); setScenarioPreview(null); setScenarioMessage(''); };
  const runScenario = async () => {
    setScenarioBusy(true); setScenarioMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/scenarios/preview`, {method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({changes:sim||{}})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body?.error||'Scenario simulation failed.');
      setScenarioPreview(body.scenario||null);
    } catch(e) { setScenarioMessage(e?.message||'Scenario simulation failed.'); }
    finally { setScenarioBusy(false); }
  };
  const saveScenario = async () => {
    if(!scenarioPreview || scenarioBusy) return;
    setScenarioBusy(true); setScenarioMessage('');
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(project.id)}/scenarios`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({changes:scenarioPreview.scenario?.changes||{}})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body?.error||'Unable to save scenario.');
      setScenarioMessage('Scenario saved as a hypothetical record. Project facts were not changed.');
    } catch(e) { setScenarioMessage(e?.message||'Unable to save scenario.'); }
    finally { setScenarioBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}><ChevronLeft size={14} /> Back to projects</button>

      <div className="flex items-start justify-between">
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint }}>{project.code} · {project.type} · {project.district}, {project.state}</div>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 23, fontWeight: 600, color: C.ink }}>{project.name}</h1>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <button onClick={downloadEvidencePack} disabled={exportingEvidence} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2" style={{ background:C.surface, color:C.primary, border:`1px solid ${C.primary}55`, fontFamily:FONT_BODY, fontSize:11.5, fontWeight:800, opacity:exportingEvidence?.65:1 }}><Download size={14}/> {exportingEvidence ? 'Preparing…' : 'Evidence pack'}</button>
              <button onClick={() => onOpenMap?.(project.id)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2" style={{ background:C.surface, color:C.primary, border:`1px solid ${C.primary}55`, fontFamily:FONT_BODY, fontSize:11.5, fontWeight:800 }}><MapPin size={14}/> Open GIS</button><button onClick={() => onAskAI(project.id)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2" style={{ background:C.primaryTint, color:C.primary, border:`1px solid ${C.primary}44`, fontFamily:FONT_BODY, fontSize:11.5, fontWeight:800 }}><MessageSquare size={14}/> Ask Bhoomi AI</button>
            </div>
            {exportMessage && <div style={{fontFamily:FONT_BODY,fontSize:10.5,color:exportMessage.includes('failed')?C.high:C.primary}}>{exportMessage}</div>}
          </div>
          <div className="text-right">
            <RiskPill band={base.band} score={base.overall} />
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint, marginTop: 3 }}>{base.overall}/100 · stored risk score · not a validated probability</div>
          </div>
        </div>
      </div>

      <Card className="bd-executive-snapshot" style={{ padding: 16 }}>
        <div className="bd-snapshot-head"><div><div className="bd-snapshot-eyebrow">Project decision snapshot</div><div className="bd-snapshot-title">Current position and next review focus</div></div><RiskPill band={base.band} score={base.overall} /></div>
        <div className="bd-snapshot-grid">
          <div><span>Current stage</span><strong>{STAGES[project.stageIndex] || "Stage not recorded"}</strong><small>{project.status === "ongoing" ? "Project is active" : "Project record is not ongoing"}</small></div>
          <div><span>Acquisition progress</span><strong>{pct}%</strong><small>{project.parcelsAcquired} of {project.totalParcels} parcels acquired</small></div>
          <div><span>Main signal</span><strong>{base.bottleneck.label.replace(" Risk", "")}</strong><small>{base.bottleneck.value}/100 category signal</small></div>
          <div><span>Next review focus</span><strong>{base.recommendedActions[0] || "Continue routine monitoring"}</strong><small>Decision-support suggestion; officer review required</small></div>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Land acquired" value={`${pct}%`} sub={`${project.parcelsAcquired} / ${project.totalParcels} parcels`} />
        <KpiCard label="Families affected" value={project.familiesAffected} sub={`${project.familiesPending} awaiting compensation`} />
        <KpiCard label="Ownership disputes" value={project.disputes} sub={`${project.courtCases} in court`} />
        <KpiCard label="Documents missing" value={project.docsMissing} sub={`Approval ${project.approvalPct}% complete`} />
      </div>

      <ProjectLocationPanel project={project} user={user} onSaved={onLocationSaved} />

      {/* Timeline */}
      <Card style={{ padding: 18 }}>
        <SectionTitle title="Acquisition progress" eyebrow="Stage timeline" />
        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const done = i < project.stageIndex;
            const current = i === project.stageIndex;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center" style={{ minWidth: 74 }}>
                  <div className={current ? "bd-step-icon" : ""} style={{ width: 30, height: 30, background: current ? C.high : done ? C.primary : C.surfaceSunk, color: current || done ? "#fff" : C.inkFaint, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, border: current ? `2px solid ${C.high}` : `1px solid ${C.border}` }}>
                    {done ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: current ? C.high : done ? C.ink : C.inkFaint, textAlign: "center", marginTop: 5, fontWeight: current ? 700 : 500, lineHeight: 1.2 }}>{s}</div>
                </div>
                {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: i < project.stageIndex ? C.primary : C.border, marginTop: -18 }} />}
              </React.Fragment>
            );
          })}
        </div>
        {project.status === "ongoing" && (
          <div className="mt-4 px-3 py-2 rounded flex items-center gap-2" style={{ background: C.highTint }}>
            <AlertTriangle size={14} color={C.high} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.high }}>Current bottleneck: <b>{STAGES[project.stageIndex]}</b> — primary risk driver is {base.bottleneck.label.toLowerCase()}.</span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Explainable AI */}
        <Card style={{ padding: 18 }}>
          <SectionTitle title="AI explanation" eyebrow="Why is this project risky?" />
          <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink, lineHeight: 1.55, marginBottom: 14 }}>{base.explanation}</p>
          <div className="flex flex-col gap-2">
            {base.drivers.map((d) => (
              <div key={d.key} className="flex items-start gap-2.5">
                <div className="mt-1"><RiskDot band={d.value >= 60 ? "high" : d.value >= 35 ? "medium" : "low"} /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: C.ink }}>{d.label}</span>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint }}>{d.value}/100</span>
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 1 }}>{d.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionTitle title="Risk by category" />
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius={72}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="subject" tick={{ fontFamily: FONT_BODY, fontSize: 10.5, fill: C.inkSoft }} />
                <Radar dataKey="value" stroke={C.primary} fill={C.primary} fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 110, marginTop: 4 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint, marginBottom: 2 }}>Risk trend across last 6 assessments</div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="step" tick={{ fontFamily: FONT_BODY, fontSize: 10, fill: C.inkFaint }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}` }} />
                <Line type="monotone" dataKey="risk" stroke={C.gold} strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <PredictiveIntelligencePanel project={project} />

      <ProjectIntelligencePanel project={project} risk={base} />

      <ProjectOpsPanel project={project} user={user} />

      <ProjectEvidencePanel project={project} />

      {/* Recommended actions */}
      <Card style={{ padding: 18 }}>
        <SectionTitle title="Recommended actions" eyebrow="Priority interventions" />
        <div className="grid grid-cols-3 gap-2.5">
          {base.recommendedActions.map((a, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded" style={{ background: C.primaryTint }}>
              <CheckCircle2 size={15} color={C.primary} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>{a}</span>
            </div>
          ))}
        </div>
      </Card>

      <ProjectActionPanel project={project} user={user} recommendedActions={base.recommendedActions} />

      {/* What-if simulation */}
      <Card style={{ padding: 18 }}>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle title="What if?" eyebrow="Simulation" />
          <div className="flex items-center gap-2">
            {sim && <Btn small variant="ghost" onClick={resetSim}>Reset</Btn>}
            <button onClick={runScenario} disabled={!sim || scenarioBusy} className="rounded px-3 py-1.5" style={{background:C.primary,color:'#fff',border:0,fontFamily:FONT_BODY,fontSize:11,fontWeight:700,opacity:(!sim||scenarioBusy)?.55:1}}>{scenarioBusy?'Running…':'Run governed scenario'}</button>
            {scenarioPreview && <button onClick={saveScenario} disabled={scenarioBusy} className="rounded px-3 py-1.5" style={{background:C.primaryTint,color:C.primary,border:`1px solid ${C.primary}44`,fontFamily:FONT_BODY,fontSize:11,fontWeight:700}}>Save scenario</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <SimSlider label="Compensation pending (days)" min={0} max={110} value={simProject.avgDelayDays} base={project.avgDelayDays} onChange={(v) => setSim((s) => ({ ...s, avgDelayDays: v }))} />
          <SimSlider label="Ownership disputes" min={0} max={12} value={simProject.disputes} base={project.disputes} onChange={(v) => setSim((s) => ({ ...s, disputes: v }))} />
          <SimSlider label="Approval completion (%)" min={0} max={100} value={simProject.approvalPct} base={project.approvalPct} onChange={(v) => setSim((s) => ({ ...s, approvalPct: v }))} />
          <SimSlider label="Documents missing" min={0} max={60} value={simProject.docsMissing} base={project.docsMissing} onChange={(v) => setSim((s) => ({ ...s, docsMissing: v }))} />
        </div>
        <div className="flex items-center gap-6 mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint }}>Current risk</div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 600, color: bandColor(base.band) }}>{base.overall}</div>
          </div>
          <ChevronRight size={18} color={C.inkFaint} />
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint }}>Simulated risk</div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 600, color: bandColor(simRisk.band) }}>{simRisk.overall}</div>
          </div>
          {sim && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded" style={{ background: delta < 0 ? C.lowTint : delta > 0 ? C.highTint : C.surfaceSunk, color: delta < 0 ? C.low : delta > 0 ? C.high : C.inkSoft }}>
              {delta < 0 ? <ArrowDownRight size={14} /> : delta > 0 ? <ArrowUpRight size={14} /> : null}
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700 }}>{delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} points`}</span>
            </div>
          )}
          {scenarioPreview && <div className="ml-auto px-3 py-2 rounded" style={{background:C.surfaceSunk,border:`1px solid ${C.border}`,fontFamily:FONT_BODY,fontSize:11,color:C.inkSoft}}>Backend-verified simulation: <b>{scenarioPreview.simulatedState?.risk}/100</b> · Δ {scenarioPreview.delta>0?'+':''}{scenarioPreview.delta}</div>}
        </div>
        {scenarioMessage && <div className="mt-3" style={{fontFamily:FONT_BODY,fontSize:10.8,color:scenarioMessage.toLowerCase().includes('failed')?C.high:C.primary}}>{scenarioMessage}</div>}
        {scenarioPreview && <div className="mt-3 px-3 py-2 rounded" style={{background:C.goldTint,color:C.gold,fontFamily:FONT_BODY,fontSize:10.8}}>Scenario simulation only — it does not mutate project facts or establish a causal or actual future outcome.</div>}
      </Card>
    </div>
  );
}

function SimSlider({ label, min, max, value, base, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: value !== base ? C.gold : C.inkFaint, fontWeight: 600 }}>{value}{value !== base ? ` (was ${base})` : ""}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" style={{ accentColor: C.primary }} />
    </div>
  );
}

/* ============================================================
   RISK MAP
   ============================================================
   Implemented in components/map/RiskMap.jsx so GIS behavior is isolated.
*/
/* ============================================================
   ALERTS
   ============================================================ */
function buildAlerts(scored) {
  const list = [];
  scored.forEach((p) => {
    if (p.status !== "ongoing") return;
    if (p.risk.band === "high") {
      list.push({ id: `${p.id}-high`, severity: "high", project: p.name, reason: `Crossed the high-risk threshold at ${p.risk.overall}/100.`, detail: p.risk.bottleneck.text, dept: "Project Coordination", action: p.risk.recommendedActions[0], type: "Risk threshold" });
    }
    if (p.disputes >= 5 || p.courtCases >= 3) {
      list.push({ id: `${p.id}-legal`, severity: "medium", project: p.name, reason: `Legal warning — ${p.disputes} ownership disputes affecting project progress.`, detail: `${p.courtCases} case(s) currently in court.`, dept: "Legal Department", action: "Prioritise high-impact disputes for resolution.", type: "Legal" });
    }
    if (p.avgDelayDays >= 60) {
      list.push({ id: `${p.id}-comp`, severity: "high", project: p.name, reason: `Compensation pending for more than 60 days (avg ${p.avgDelayDays}d).`, detail: `${p.familiesPending} families awaiting payment.`, dept: "Revenue / Compensation Cell", action: "Clear the compensation backlog for cases over 30 days.", type: "Compensation" });
    }
    if (p.docsMissing >= 30) {
      list.push({ id: `${p.id}-doc`, severity: "medium", project: p.name, reason: `${p.docsMissing} documents missing, blocking approval progress.`, detail: `Approval completion currently ${p.approvalPct}%.`, dept: "District Administration", action: "Assign responsible officers with a completion deadline.", type: "Documentation" });
    }
  });
  return list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}

function AlertsPage({ scored, openProject }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/alerts?status=all&limit=300", { credentials: "include", headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load persistent alerts.");
      setAlerts(Array.isArray(body?.alerts) ? body.alerts : []);
    } catch (e) {
      setMessage(e?.message || "Unable to load persistent alerts.");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const generate = async () => {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/alerts/generate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to generate operational alerts.");
      setMessage(`${body?.count || 0} operational alerts generated or updated.`);
      await refresh();
    } catch (e) { setMessage(e?.message || "Unable to generate operational alerts."); }
    finally { setBusy(false); }
  };

  const updateStatus = async (id, status) => {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ status }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to update alert status.");
      setAlerts((current) => current.map((a) => a.id === id ? body.alert : a));
    } catch (e) { setMessage(e?.message || "Unable to update alert status."); }
    finally { setBusy(false); }
  };

  const visible = alerts.filter((a) => filter === "all" ? true : String(a.status || "open") === filter);
  const severitySummary = useMemo(() => visible.reduce((acc, a) => { const s = String(a.severity || "medium").toLowerCase(); acc[s] = (acc[s] || 0) + 1; return acc; }, {}), [visible]);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle eyebrow={`${alerts.length} persistent alerts`} title="Early-warning alerts" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {["open", "acknowledged", "resolved", "dismissed", "all"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded" style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, background: filter === f ? C.primary : C.surface, color: filter === f ? "#fff" : C.inkSoft, border: `1px solid ${filter === f ? C.primary : C.border}`, textTransform: "capitalize" }}>{f}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn small variant="subtle" onClick={refresh} disabled={loading || busy} icon={Database}>Refresh</Btn>
          <Btn small onClick={generate} disabled={busy} icon={Plus}>Generate warnings</Btn>
        </div>
      </div>
      {!loading && visible.length > 0 && <div className="bd-alert-summary">
        <div><span>Showing</span><strong>{visible.length}</strong><small>current alerts</small></div>
        <div className="high"><span>High</span><strong>{severitySummary.high || 0}</strong><small>priority review</small></div>
        <div className="medium"><span>Medium</span><strong>{severitySummary.medium || 0}</strong><small>watch and review</small></div>
        <div className="neutral"><span>Resolved</span><strong>{alerts.filter(a => String(a.status || "").toLowerCase() === "resolved").length}</strong><small>in repository</small></div>
      </div>}
      {message && <div className="rounded px-3 py-2" style={{ background: C.primaryTint, border: `1px solid ${C.border}`, color: C.primary, fontFamily: FONT_BODY, fontSize: 11.5 }}>{message}</div>}
      {loading && <Card style={{ padding: 24, textAlign: "center" }}><span style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkFaint }}>Loading persistent operational alerts…</span></Card>}
      {!loading && visible.length === 0 && <Card style={{ padding: 24, textAlign: "center" }}><span style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkFaint }}>No alerts in this view. Generate operational warnings from the current authorised project repository.</span></Card>}
      {!loading && visible.length > 0 && <div className="flex flex-col gap-2.5">
        {visible.map((a) => {
          const severity = String(a.severity || "medium").toLowerCase();
          const status = String(a.status || "open").toLowerCase();
          return (
            <Card key={a.id} style={{ padding: "14px 16px" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5"><AlertTriangle size={17} color={severity === "critical" || severity === "high" ? C.high : C.med} /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: severity === "critical" || severity === "high" ? C.high : C.med }}>{severity.toUpperCase()}</span>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>· {a.category || a.sourceType || "Operational"}</span>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint }}>· {status}</span>
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 650, color: C.ink, marginTop: 3 }}>{a.projectName || a.projectCode || "Project"}</div>{openProject && (() => { const match = scored.find(p => p.id === a.projectId || p.name === a.projectName || p.code === a.projectCode); return match ? <button className="bd-inline-project" onClick={() => openProject(match.id)}><ArrowUpRight size={12}/> Open project</button> : null; })()}
                    <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{a.reason || a.title}</div>
                    <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded" style={{ background: C.primaryTint, width: "fit-content" }}>
                      <CheckCircle2 size={12} color={C.primary} />
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.primary }}>{a.metadata?.warning?.nextAction || "Review the current warning evidence and verify the bottleneck."}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {status === "open" && <Btn small variant="subtle" onClick={() => updateStatus(a.id, "acknowledged")} disabled={busy}>Acknowledge</Btn>}
                  {status === "acknowledged" && <Btn small variant="subtle" onClick={() => updateStatus(a.id, "resolved")} disabled={busy}>Resolve</Btn>}
                  {(status === "open" || status === "acknowledged") && <Btn small variant="ghost" onClick={() => updateStatus(a.id, "dismissed")} disabled={busy}>Dismiss</Btn>}
                  {status === "resolved" && <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.low, fontWeight: 700 }}>Resolved</span>}
                  {status === "dismissed" && <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, fontWeight: 700 }}>Dismissed</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>}
      <Card style={{ padding: 12, background: C.surfaceSunk }}><div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>Alerts in this workspace are persistent operational records. Their source, rule version, status changes and audit events remain subject to the authorised workflow and are not claims of causality or validated ML probability.</div></Card>
    </div>
  );
}

/* ============================================================
   HISTORICAL ANALYSIS
   ============================================================ */
function HistoryPage({ scored, openProject }) {
  const [scope, setScope] = useState('portfolio');
  const [selectedType, setSelectedType] = useState('All types');
  const [selectedDistrict, setSelectedDistrict] = useState('All districts');
  const [focus, setFocus] = useState(null);

  const completed = useMemo(() => scored.filter((p) => p.status === 'completed'), [scored]);
  const ongoing = useMemo(() => scored.filter((p) => p.status === 'ongoing'), [scored]);
  const base = scope === 'completed' ? completed : ongoing;
  const types = useMemo(() => ['All types', ...new Set(scored.map((p) => p.type))], [scored]);
  const districts = useMemo(() => ['All districts', ...new Set(scored.map((p) => p.district))].sort(), [scored]);

  const filtered = useMemo(() => base.filter((p) =>
    (selectedType === 'All types' || p.type === selectedType) &&
    (selectedDistrict === 'All districts' || p.district === selectedDistrict)
  ), [base, selectedType, selectedDistrict]);

  const byType = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const item = map.get(p.type) || { type: p.type, avgRisk: 0, projects: 0 };
      item.avgRisk += p.risk.overall; item.projects += 1; map.set(p.type, item);
    });
    return [...map.values()].map((x) => ({ ...x, avgRisk: Math.round(x.avgRisk / x.projects) }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  }, [filtered]);

  const byDistrict = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const item = map.get(p.district) || { district: p.district, avgRisk: 0, projects: 0 };
      item.avgRisk += p.risk.overall; item.projects += 1; map.set(p.district, item);
    });
    return [...map.values()].map((x) => ({ ...x, avgRisk: Math.round(x.avgRisk / x.projects) }))
      .sort((a, b) => b.avgRisk - a.avgRisk).slice(0, 10);
  }, [filtered]);

  const causes = useMemo(() => {
    const keys = ['compensation', 'legal', 'approval', 'documentation', 'resettlement', 'administrative'];
    return keys.map((k) => ({
      cause: CATEGORY_LABEL[k].replace(' Risk', ''),
      avg: filtered.length ? Math.round(filtered.reduce((s, p) => s + p.risk.categories[k], 0) / filtered.length) : 0,
      key: k,
    }));
  }, [filtered]);

  const onTime = completed.filter((p) => p.actualDays <= p.plannedDays).length;
  const delayed = completed.length - onTime;
  const avgDuration = completed.length ? Math.round(completed.reduce((s, p) => s + p.actualDays, 0) / completed.length) : 0;
  const mostCommon = causes.slice().sort((a, b) => b.avg - a.avg)[0];

  const resetFilters = () => { setSelectedType('All types'); setSelectedDistrict('All districts'); setFocus(null); };
  const handleChartClick = (data) => {
    const key = data?.activePayload?.[0]?.payload;
    if (key?.type) { setSelectedType(key.type); setFocus(`Project type: ${key.type}`); }
    if (key?.district) { setSelectedDistrict(key.district); setFocus(`District: ${key.district}`); }
    if (key?.cause) { setFocus(`Delay driver: ${key.cause}`); }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle eyebrow={`${completed.length} completed projects analysed`} title="Historical analysis" />
      <Card style={{ padding: 14 }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>
              Analysis scope
              <select value={scope} onChange={(e) => { setScope(e.target.value); setFocus(null); }} style={{ display: 'block', marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 9px', fontFamily: FONT_BODY, fontSize: 12.5 }}>
                <option value="portfolio">Current portfolio</option><option value="completed">Completed outcomes</option>
              </select>
            </label>
            <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>
              Project type
              <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setFocus(`Project type: ${e.target.value}`); }} style={{ display: 'block', marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 9px', fontFamily: FONT_BODY, fontSize: 12.5 }}>
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>
              District
              <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setFocus(`District: ${e.target.value}`); }} style={{ display: 'block', marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 9px', fontFamily: FONT_BODY, fontSize: 12.5 }}>
                {districts.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            {(selectedType !== 'All types' || selectedDistrict !== 'All districts') && <button onClick={resetFilters} style={{ alignSelf: 'end', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', background: C.surfaceSunk, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: C.inkSoft }}>Reset</button>}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>{focus || `${filtered.length} projects in current analysis scope`}</div>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Avg. acquisition duration" value={`${avgDuration}d`} sub="Completed projects" />
        <KpiCard label="Completed on time" value={onTime} sub={`of ${completed.length} completed projects`} />
        <KpiCard label="Completed with delay" value={delayed} sub={`of ${completed.length} completed projects`} />
        <KpiCard label="Most prominent driver" value={mostCommon?.cause || '—'} sub={scope === 'completed' ? 'Across completed outcomes' : 'Across current analysis scope'} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card style={{ padding: 18 }}>
          <SectionTitle title="Delay causes" eyebrow={`${scope === 'completed' ? 'Completed outcomes' : 'Current portfolio'} · click a bar to inspect the driver`} />
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={causes} margin={{ left: 2, right: 10, top: 8, bottom: 8 }} onClick={handleChartClick}>
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="cause" tick={{ fontFamily: FONT_BODY, fontSize: 10, fill: C.inkSoft }} axisLine={{ stroke: C.border }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: FONT_BODY, fontSize: 10.5, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}` }} formatter={(value) => [`${value}/100`, 'Average risk']} labelFormatter={(label) => `${label} risk`} />
                <Bar dataKey="avg" fill={C.primary} radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{ padding: 18 }}>
          <SectionTitle title="Project-type performance" eyebrow="Average risk by type · click a bar to filter" />
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} margin={{ left: 2, right: 10, top: 8, bottom: 8 }} onClick={handleChartClick}>
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="type" tick={{ fontFamily: FONT_BODY, fontSize: 10, fill: C.inkSoft }} axisLine={{ stroke: C.border }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: FONT_BODY, fontSize: 10.5, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}` }} formatter={(value, name, item) => [`${value}/100`, `${item?.payload?.projects || 0} projects`]} />
                <Bar dataKey="avgRisk" fill={C.gold} radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{ padding: 18, gridColumn: 'span 2' }}>
          <SectionTitle title="District-wise risk" eyebrow="Top 10 districts by average risk · click a bar to filter" />
          <div style={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDistrict} margin={{ left: 2, right: 10, top: 8, bottom: 8 }} onClick={handleChartClick}>
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="district" tick={{ fontFamily: FONT_BODY, fontSize: 10, fill: C.inkSoft }} axisLine={{ stroke: C.border }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: FONT_BODY, fontSize: 10.5, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}` }} formatter={(value, name, item) => [`${value}/100`, `${item?.payload?.projects || 0} projects`]} />
                <Bar dataKey="avgRisk" radius={[4, 4, 0, 0]} cursor="pointer">
                  {byDistrict.map((d) => <Cell key={d.district} fill={d.avgRisk >= 65 ? C.high : d.avgRisk >= 40 ? C.med : C.low} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {filtered.length === 0 && <div className="mt-2 rounded-md px-3 py-2" style={{ background: C.highTint, color: C.high, fontFamily: FONT_BODY, fontSize: 11.5 }}>No projects match the selected filters.</div>}
          {filtered.length > 0 && <div className="mt-3" style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>Tip: click a project type or district bar to narrow the analysis. Open the project register for record-level evidence.</div>}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   OFFICER FEEDBACK
   ============================================================ */
const INITIAL_FEEDBACK = [];

function FeedbackPage({ scored, role }) {
  const canSubmit = role !== "Viewer";
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ projectId: scored[0]?.id || "", type: "New issue", category: "Compensation", text: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedProject = scored.find((p) => p.id === form.projectId) || scored[0] || null;

  async function load(projectId) {
    if (!projectId) return;
    setLoading(true); setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/feedback`, { credentials: "include", headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load feedback.");
      setList(Array.isArray(body?.feedback) ? body.feedback : []);
    } catch (e) { setMessage(e?.message || "Unable to load feedback."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (form.projectId) load(form.projectId); }, [form.projectId]);

  async function submit() {
    if (!canSubmit || !selectedProject || !form.text.trim() || saving) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(selectedProject.id)}/feedback`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ signalType: form.type, category: form.category, observation: form.text.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to save feedback.");
      setList((current) => [body.feedback, ...current]);
      setForm((f) => ({ ...f, text: "" }));
      setMessage("Feedback saved to the persistent evidence/feedback record.");
    } catch (e) { setMessage(e?.message || "Unable to save feedback."); }
    finally { setSaving(false); }
  }

  const inputStyle = { fontFamily: FONT_BODY, fontSize: 12.5, border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 9px", width: "100%", background: C.surface };
  const formatDate = (value) => value ? new Date(value).toLocaleString() : "—";

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle eyebrow="Verified ground-level signals can feed future model learning" title="Officer feedback" />
      <div className="grid gap-4" style={{ gridTemplateColumns: "340px 1fr" }}>
        <Card style={{ padding: 16, height: "fit-content" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Submit feedback</div>
          {!canSubmit && <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint, marginBottom: 8 }}>Viewer role has read-only access.</div>}
          <div className="flex flex-col gap-2.5">
            <div>
              <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>Project</label>
              <select disabled={!canSubmit} style={inputStyle} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                {scored.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>Signal type</label>
                <select disabled={!canSubmit} style={inputStyle} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option>Confirm risk</option><option>Correct risk</option><option>New issue</option>
                </select>
              </div>
              <div className="flex-1">
                <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>Category</label>
                <select disabled={!canSubmit} style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option>Compensation</option><option>Legal</option><option>Approval</option><option>Documentation</option><option>Resettlement</option><option>Administrative</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>Observation</label>
              <textarea disabled={!canSubmit} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} placeholder="Describe what you're seeing on the ground..." />
            </div>
            <Btn onClick={submit} disabled={!canSubmit || saving || !form.text.trim()}>{saving ? "Saving…" : "Submit feedback"}</Btn>
            {message && <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: message.includes("Unable") ? C.high : C.primary }}>{message}</div>}
          </div>
        </Card>
        <div className="flex flex-col gap-2.5">
          {loading && <Card style={{ padding: 14 }}><span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkFaint }}>Loading persistent feedback…</span></Card>}
          {!loading && list.length === 0 && <Card style={{ padding: 16 }}><span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkFaint }}>No recorded feedback for this project yet.</span></Card>}
          {!loading && list.map((f) => (
            <Card key={f.id} style={{ padding: 14 }}>
              <div className="flex items-center justify-between gap-3">
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.ink }}>{selectedProject?.name || "Project"}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>{formatDate(f.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.primary, background: C.primaryTint, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>{f.signalType}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>{f.category} · {f.userRole || "Recorded user"}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint }}>{f.verificationStatus}{f.learningEligible ? " · learning eligible" : ""}</span>
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, marginTop: 6, lineHeight: 1.5 }}>{f.observation}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectActionPanel({ project, user, recommendedActions = [] }) {
  const canAct = user?.role === "Administrator" || (user?.permissions || []).includes("workflow:action") || (user?.permissions || []).includes("*");
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [outcomes, setOutcomes] = useState({});

  async function load() {
    if (!project?.id) return;
    setLoading(true); setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/interventions`, { credentials: "include", headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load intervention actions.");
      setActions(Array.isArray(body?.actions) ? body.actions : []);
    } catch (e) { setMessage(e?.message || "Unable to load intervention actions."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [project?.id]);

  async function createAction(actionText) {
    if (!canAct || !actionText || saving) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/interventions`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ actionText, scenario: { type: "officer_action", label: actionText }, estimatedEffect: { note: "Scenario/action record only; not causal evidence." } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to record the intervention.");
      setActions((current) => [body.action, ...current]);
      setMessage("Action recorded persistently. It remains separate from prediction evidence until an observed outcome is verified.");
    } catch (e) { setMessage(e?.message || "Unable to record intervention."); }
    finally { setSaving(false); }
  }

  async function updateAction(id, status, outcome) {
    if (!canAct || saving) return;
    setSaving(true); setMessage("");
    try {
      const payload = { status };
      if (outcome !== undefined) payload.outcome = { note: String(outcome || "").trim(), observedAt: new Date().toISOString() };
      const res = await fetch(`/api/intervention-actions/${encodeURIComponent(id)}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to update action.");
      setActions((current) => current.map((a) => a.id === id ? body.action : a));
      if (outcome !== undefined) setOutcomes((current) => ({ ...current, [id]: "" }));
      setMessage(outcome !== undefined ? "Observed outcome recorded and awaiting authorized verification." : "Action status updated and audited.");
    } catch (e) { setMessage(e?.message || "Unable to update action."); }
    finally { setSaving(false); }
  }

  async function reviewOutcome(id, status, learningEligible) {
    if (!canAct || saving) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/intervention-actions/${encodeURIComponent(id)}/outcome-review`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ status, learningEligible, reviewNote: status === "verified" ? "Outcome verified by authorised workflow user." : "Outcome rejected by authorised workflow user." }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to review outcome.");
      setActions((current) => current.map((a) => a.id === id ? body.action : a));
      setMessage(status === "verified" ? (learningEligible ? "Outcome verified and marked learning-eligible." : "Outcome verified; not marked learning-eligible.") : "Outcome review recorded as rejected.");
    } catch (e) { setMessage(e?.message || "Unable to review outcome."); }
    finally { setSaving(false); }
  }

  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle title="Evidence → Action" eyebrow="Persistent intervention workflow" />
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint, marginBottom: 10 }}>Record an operational action, then record the observed outcome. Scenario estimates are not causal evidence; only verified outcomes can become learning-eligible.</div>
      {!canAct && <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint, marginBottom: 9 }}>Your role is read-only for workflow actions.</div>}
      <div className="grid gap-2">
        {recommendedActions.slice(0, 4).map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded px-3 py-2" style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{a}</span>
            <button disabled={!canAct || saving} onClick={() => createAction(a)} className="rounded px-2.5 py-1.5" style={{ background: C.primary, color: "#fff", border: 0, fontSize: 10.5, fontWeight: 700, opacity: !canAct || saving ? 0.5 : 1 }}>Record action</button>
          </div>
        ))}
      </div>
      {loading && <div className="mt-3" style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>Loading recorded actions…</div>}
      {!loading && actions.length === 0 && <div className="mt-3" style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkFaint }}>No intervention actions recorded yet.</div>}
      {!loading && actions.length > 0 && <div className="mt-3 flex flex-col gap-2">
        {actions.slice(0, 8).map((a) => (
          <div key={a.id} className="rounded px-3 py-2" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between gap-2"><span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.ink, fontWeight: 700, lineHeight: 1.4 }}>{a.actionText}</span>
              <select disabled={!canAct || saving} value={a.status} onChange={(e) => updateAction(a.id, e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 6px", fontSize: 10.5, background: C.surface, minWidth: 105 }}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint, marginTop: 3 }}>Recorded {a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"} · {a.ownerRole || "workflow"}</div>
            <div className="mt-2 rounded p-2" style={{ background: C.surfaceSunk }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>Observed outcome</div>
              {a.outcome ? (
                <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.ink, lineHeight: 1.45 }}>{a.outcome.note || "Outcome recorded."}</div>
              ) : (
                <div className="flex gap-2 items-end">
                  <textarea disabled={!canAct || saving} value={outcomes[a.id] || ""} onChange={(e) => setOutcomes((current) => ({ ...current, [a.id]: e.target.value }))} placeholder="Record what actually happened after the intervention…" style={{ fontFamily: FONT_BODY, fontSize: 11.5, border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", minHeight: 54, resize: "vertical", flex: 1, background: C.surface }} />
                  <button disabled={!canAct || saving || !(outcomes[a.id] || "").trim()} onClick={() => updateAction(a.id, a.status === "planned" ? "completed" : a.status, outcomes[a.id])} className="rounded px-2.5 py-1.5" style={{ background: C.primary, color: "#fff", border: 0, fontSize: 10.5, fontWeight: 700, opacity: (!canAct || saving || !(outcomes[a.id] || "").trim()) ? 0.5 : 1 }}>Record outcome</button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint }}>Verification: {a.outcomeVerificationStatus || "unreviewed"}</span>
                {a.learningEligible ? <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.low, fontWeight: 700 }}>Learning eligible</span> : <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint }}>Not learning eligible</span>}
                {a.outcome && canAct && a.outcomeVerificationStatus !== "verified" && (
                  <>
                    <button disabled={saving} onClick={() => reviewOutcome(a.id, "verified", false)} className="rounded px-2 py-1" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.primary, fontSize: 10, fontWeight: 700 }}>Verify outcome</button>
                    <button disabled={saving} onClick={() => reviewOutcome(a.id, "verified", true)} className="rounded px-2 py-1" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.primary, fontSize: 10, fontWeight: 700 }}>Verify + learning</button>
                    <button disabled={saving} onClick={() => reviewOutcome(a.id, "rejected", false)} className="rounded px-2 py-1" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.high, fontSize: 10, fontWeight: 700 }}>Reject</button>
                  </>
                )}
                {a.outcomeVerificationStatus === "verified" && a.outcomeReviewNote && <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: C.inkFaint }}>{a.outcomeReviewNote}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>}
      {message && <div className="mt-2" style={{ fontFamily: FONT_BODY, fontSize: 10.8, color: message.includes("Unable") ? C.high : C.primary }}>{message}</div>}
    </Card>
  );
}

/* ============================================================
   BHOOMI AI CHAT ASSISTANT
   ============================================================ */
const SUGGESTED_PROMPTS = [
  "Which projects are most likely to be delayed?",
  "Why is NH-44 Salem high risk?",
  "Which projects have compensation pending more than 60 days?",
  "What should we prioritise this week?",
  "Which district has the highest acquisition risk?",
];

/* ============================================================
   ADD PROJECT (manual form + CSV/JSON import)
   ============================================================ */
const EMPTY_FORM = {
  name: "", code: "", type: "Highway", state: "Tamil Nadu", district: "", responsibleDepartment: "",
  totalParcels: 100, parcelsAcquired: 50, familiesAffected: 50, familiesPending: 10,
  avgDelayDays: 30, disputes: 1, courtCases: 0, approvalPct: 70, docsMissing: 8,
  resettlementPct: 70, rehabPct: 65, depts: 4, prevDelays: 0, stageIndex: 4, status: "ongoing",
  latitude: "", longitude: "", locationPrecision: 'UNRESOLVED', locationSource: '', locationLabel: '', locationOsmType: '', locationOsmId: '', locationBBox: null, locationConfirmed: false,
};

const PROJECT_TYPES = ["Highway", "Railway", "Airport", "Industrial Corridor", "Power Transmission", "Irrigation", "Port"];
const NUMERIC_FIELDS = ["totalParcels", "parcelsAcquired", "familiesAffected", "familiesPending", "avgDelayDays", "disputes", "courtCases", "approvalPct", "docsMissing", "resettlementPct", "rehabPct", "depts", "prevDelays", "stageIndex"];

const IMPORT_ALIASES = {
  name:'name,project_name,projectName,project_title,projectTitle', code:'code,project_code,projectCode,project_id,projectId',
  type:'type,project_type,projectType', state:'state,state_name,stateName', district:'district,district_name,districtName', responsibleDepartment:'responsibleDepartment,responsible_department,department,responsible_unit,work_unit',
  totalParcels:'totalParcels,total_parcels,total_land_parcels,totalLandParcels', parcelsAcquired:'parcelsAcquired,parcels_acquired,acquired_parcels,acquiredParcels',
  familiesAffected:'familiesAffected,families_affected,affected_families,affectedFamilies', familiesPending:'familiesPending,families_pending,pending_compensation_cases,pendingCompensationCases',
  avgDelayDays:'avgDelayDays,avg_delay_days,current_delay_days,currentDelayDays', disputes:'disputes,ownership_disputes,ownershipDisputes',
  courtCases:'courtCases,court_cases,legal_cases,legalCases', approvalPct:'approvalPct,approval_pct,approval_complete_pct,approvalCompletePct',
  docsMissing:'docsMissing,docs_missing,documents_missing,documentation_gap', resettlementPct:'resettlementPct,resettlement_pct,resettlement_progress_pct',
  rehabPct:'rehabPct,rehab_pct,rehabilitation_pct', depts:'depts,departments_involved,departmentsInvolved', prevDelays:'prevDelays,prev_delays,prior_delays,priorDelays',
  stageIndex:'stageIndex,stage_index,acquisition_stage_index,acquisitionStageIndex', status:'status,project_status,projectStatus',
  latitude:'latitude,lat,project_latitude,projectLatitude', longitude:'longitude,lon,lng,project_longitude,projectLongitude',
  locationPrecision:'locationPrecision,location_precision', locationSource:'locationSource,location_source', locationLabel:'locationLabel,location_label'
};
function canonicalImportRow(row){
  const src=Object.fromEntries(Object.entries(row||{}).map(([k,v])=>[String(k).trim(),v]));
  const out={};
  for(const [field,aliases] of Object.entries(IMPORT_ALIASES)){
    const keys=aliases.split(',');
    const hit=keys.find(k=>Object.prototype.hasOwnProperty.call(src,k) && String(src[k]??'').trim()!=='');
    if(hit) out[field]=src[hit];
  }
  return out;
}
function normaliseImportedRow(row, idx) {
  const out = { ...EMPTY_FORM, ...canonicalImportRow(row) };
  NUMERIC_FIELDS.forEach((f) => { out[f] = Number(out[f]) || 0; });
  out.name = normaliseDisplayText(out.name || `Imported Project ${idx + 1}`);
  out.code = normaliseDisplayText(out.code || `IMP-${Date.now()}-${idx}`);
  out.state = normaliseDisplayText(out.state || "Tamil Nadu");
  out.district = normaliseDisplayText(out.district || "");
  if (!out.district) throw new Error(`Row ${idx + 1}: district is required so the project can be mapped safely.`);
  out.status = String(out.status).toLowerCase() === "completed" ? "completed" : "ongoing";
  out.stageIndex = clamp(Math.round(out.stageIndex), 0, 7);
  const x = null, y = null;
  const lat = out.latitude === '' || out.latitude == null ? null : Number(out.latitude);
  const lon = out.longitude === '' || out.longitude == null ? null : Number(out.longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lon);
  if ((out.latitude !== null && out.latitude !== '') !== (out.longitude !== null && out.longitude !== '')) throw new Error(`Row ${idx + 1}: latitude and longitude must be supplied together.`);
  if (hasPoint && (lat < 6 || lat > 38.5 || lon < 68 || lon > 98.5)) throw new Error(`Row ${idx + 1}: coordinates must fall within the India GIS integrity boundary.`);
  return { id: `P-${Date.now()}-${idx}-${Math.round(Math.random() * 999)}`, x, y, ...out, latitude: hasPoint ? lat : null, longitude: hasPoint ? lon : null, locationPrecision: hasPoint && (!out.locationPrecision || String(out.locationPrecision).toUpperCase() === 'UNRESOLVED') ? 'PROJECT_POINT' : out.locationPrecision };
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "bhoomidrishti_project_template.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Small labeled-field wrapper for the Add Project form. Defined at module scope
   (not inside AddProjectPage) so React doesn't treat it as a new component type
   on every keystroke — that bug was making the form inputs lose focus while typing. */
function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, display: "block", marginBottom: 2 }}>{label}</label>
      {children}
    </div>
  );
}

function AddProjectPage({ onAddProjects, role }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedMsg, setSavedMsg] = useState("");
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState("");
  const [manualError, setManualError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const fileInputRef = useRef(null);
  const canEdit = role === "Administrator" || role === "Government Officer";

  const set = (field, value) => { setManualError(""); setForm((f) => ({ ...f, [field]: value })); };

  const searchLocation = async () => {
    const q = locationQuery.trim() || [form.district, form.state, 'India'].filter(Boolean).join(', ');
    if (!q || locationSearching) return;
    setLocationSearching(true); setManualError(''); setLocationResults([]);
    try {
      const r = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Location search failed.');
      setLocationResults(Array.isArray(body?.results) ? body.results : []);
    } catch(e) { setManualError(e?.message || 'Location search failed.'); } finally { setLocationSearching(false); }
  };
  const selectLocation = (r, force=false) => {
    const projectState=String(form.state||'').trim().toLowerCase();
    const projectDistrict=String(form.district||'').trim().toLowerCase();
    const resultState=String(r?.address?.state||'').trim().toLowerCase();
    const resultDistrict=String(r?.address?.district||'').trim().toLowerCase();
    const stateMismatch=Boolean(resultState && projectState && !resultState.includes(projectState) && !projectState.includes(resultState));
    const districtMismatch=Boolean(resultDistrict && projectDistrict && !resultDistrict.includes(projectDistrict) && !projectDistrict.includes(resultDistrict));
    if(!force && (stateMismatch||districtMismatch)){
      setPendingLocation({r,stateMismatch,districtMismatch});
      setManualError('Selected map result does not clearly match this project district/state. Review it before confirming.');
      return;
    }
    setPendingLocation(null);
    set('latitude', Number(r.lat)); set('longitude', Number(r.lon));
    setForm(f => ({...f, locationPrecision:'GEOCODED_PLACE', locationSource:'NOMINATIM_OSM', locationLabel:r.displayName||'', locationOsmType:r.osmType||'', locationOsmId:r.osmId??'', locationBBox:r.boundingBox||null, locationConfirmed:true}));
    setLocationResults([]);
    setManualError('Location selected and confirmed for this project.');
  };

  const submitManual = async () => {
    if (!form.name.trim() || !form.district.trim() || saving) { setSavedMsg(""); return; }
    if (pendingLocation) { setManualError('Confirm the location result before saving the project.'); return; }
    const x = null, y = null;
    const project = { id: `P-${Date.now()}`, code: form.code.trim() || `NEW-${Math.round(Math.random() * 9000 + 1000)}`, x, y, ...form, latitude: form.latitude===''?null:Number(form.latitude), longitude: form.longitude===''?null:Number(form.longitude), name: form.name.trim(), district: form.district.trim() };
    setSaving(true); setSavedMsg(""); setManualError(""); setImportError("");
    try { await onAddProjects([project]); setSavedMsg(`"${project.name}" was saved to the persistent project repository.`); setForm(EMPTY_FORM); setLocationQuery(''); setLocationResults([]); }
    catch (e) { setManualError(e?.message || "Unable to save the project."); }
    finally { setSaving(false); }
  };

  const handleFile = (file) => {
    setImportError(""); setImportRows([]);
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (isCsv) {
          const parsed = Papa.parse(reader.result, { header: true, skipEmptyLines: true });
          if (parsed.errors && parsed.errors.length) throw new Error(parsed.errors[0].message);
          setImportRows(parsed.data.map((r, i) => normaliseImportedRow(r, i)));
        } else {
          const json = JSON.parse(reader.result);
          const arr = Array.isArray(json) ? json : [json];
          setImportRows(arr.map((r, i) => normaliseImportedRow(r, i)));
        }
      } catch (e) {
        setImportError("Couldn't read that file. Make sure it's a valid .csv (with a header row) or .json array matching the template.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (saving) return;
    setSaving(true); setSavedMsg(""); setImportError("");
    try { await onAddProjects(importRows); setSavedMsg(`${importRows.length} project${importRows.length === 1 ? "" : "s"} imported successfully into the persistent project repository.`); setImportRows([]); if (fileInputRef.current) fileInputRef.current.value = ""; }
    catch (e) { setImportError(e?.message || "Unable to import projects."); }
    finally { setSaving(false); }
  };

  const inputStyle = { fontFamily: FONT_BODY, fontSize: 12.5, border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 9px", width: "100%", background: C.surface };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle eyebrow="Add new project data to the dashboard" title="Add project" />
      {!canEdit && (
        <Card style={{ padding: "10px 14px", background: C.goldTint }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.gold }}>Viewer role has read-only access — switch roles to add or import projects.</span>
        </Card>
      )}
      {savedMsg && (
        <Card style={{ padding: "10px 14px", background: C.lowTint }}>
          <div className="flex items-center gap-2"><CheckCircle2 size={15} color={C.low} /><span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.low }}>{savedMsg}</span></div>
        </Card>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Manual entry */}
        <Card style={{ padding: 18 }}>
          <div className="flex items-center gap-2 mb-3"><FilePlus2 size={16} color={C.primary} /><span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: C.ink }}>Add a project manually</span></div>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Project name"><input disabled={!canEdit} style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. NH-77 Bypass" /></Field>
              <Field label="Project code"><input disabled={!canEdit} style={inputStyle} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" /></Field>
              <Field label="Project type">
                <select disabled={!canEdit} style={inputStyle} value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="State">
                <select disabled={!canEdit} style={inputStyle} value={form.state} onChange={(e) => set("state", e.target.value)}>
                  {Object.keys(STATE_COORDS).map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="District"><input disabled={!canEdit} style={inputStyle} value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="e.g. Salem" /></Field>
              <Field label="Responsible department / work unit"><input disabled={!canEdit} style={inputStyle} value={form.responsibleDepartment} onChange={(e) => set("responsibleDepartment", e.target.value)} placeholder="e.g. Revenue / Land Acquisition Cell" /></Field>
              <Field label="Status">
                <select disabled={!canEdit} style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="ongoing">Ongoing</option><option value="completed">Completed</option>
                </select>
              </Field>
            </div>
            <div className="rounded-md p-3" style={{ border: `1px solid ${C.border}`, background: C.surfaceSunk }}>
              <div className="flex items-center justify-between gap-2 mb-2"><div><div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: C.ink }}>Precise map location</div><div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkFaint, marginTop: 2 }}>Use project coordinates or a deliberate place search. No random map position is generated.</div></div><MapPin size={16} color={C.primary}/></div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Latitude"><input disabled={!canEdit} type="number" step="any" style={inputStyle} value={form.latitude} onChange={e=>set('latitude',e.target.value)} placeholder="e.g. 26.7606" /></Field>
                <Field label="Longitude"><input disabled={!canEdit} type="number" step="any" style={inputStyle} value={form.longitude} onChange={e=>set('longitude',e.target.value)} placeholder="e.g. 83.3732" /></Field>
              </div>
              <div className="flex gap-2 mt-2"><input disabled={!canEdit} style={{...inputStyle, flex:1}} value={locationQuery} onChange={e=>setLocationQuery(e.target.value)} placeholder="Search project/city/road + district + state"/><Btn onClick={searchLocation} disabled={!canEdit||locationSearching} variant="ghost" small icon={MapPin}>{locationSearching?'Searching…':'Find location'}</Btn></div>
              {locationResults.length>0 && <div className="mt-2 flex flex-col gap-1.5">{locationResults.map((r,i)=><button key={`${r.osmType}-${r.osmId}-${i}`} onClick={()=>selectLocation(r)} className="text-left rounded px-2.5 py-2" style={{background:C.surface,border:`1px solid ${C.border}`}}><div style={{fontFamily:FONT_BODY,fontSize:11.5,fontWeight:700,color:C.ink}}>{r.displayName}</div><div style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkFaint,marginTop:2}}>Lat {Number(r.lat).toFixed(6)} · Lon {Number(r.lon).toFixed(6)} · {r.osmType||'OSM'} {r.osmId??''}</div>{(r.address?.district||r.address?.state)&&<div style={{fontFamily:FONT_BODY,fontSize:9.8,color:C.inkFaint,marginTop:2}}>{[r.address?.district,r.address?.state].filter(Boolean).join(' · ')}</div>}</button>)}</div>}
              {pendingLocation && <div className="mt-2 rounded px-3 py-2" style={{background:C.highTint,border:`1px solid ${C.high}`}}><div style={{fontFamily:FONT_BODY,fontSize:10.8,color:C.ink,fontWeight:700}}>Location mismatch — review</div><div style={{fontFamily:FONT_BODY,fontSize:10,color:C.inkFaint,marginTop:3}}>{pendingLocation.r.displayName}</div><button onClick={()=>selectLocation(pendingLocation.r,true)} style={{marginTop:7,border:0,borderRadius:5,padding:'6px 9px',background:C.high,color:'#fff',fontFamily:FONT_BODY,fontSize:10.5,fontWeight:700}}>Confirm this result anyway</button></div>}
              <div className="mt-2" style={{fontFamily:FONT_BODY,fontSize:10.2,color:C.inkFaint}}>Mapping status: {form.latitude!==''&&form.longitude!=='' ? (form.locationPrecision||'PROJECT_POINT').replaceAll('_',' ') : 'UNRESOLVED — this project will not be plotted until a project-level location is supplied.'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <Field label="Total parcels"><input disabled={!canEdit} type="number" style={inputStyle} value={form.totalParcels} onChange={(e) => set("totalParcels", Number(e.target.value))} /></Field>
              <Field label="Parcels acquired"><input disabled={!canEdit} type="number" style={inputStyle} value={form.parcelsAcquired} onChange={(e) => set("parcelsAcquired", Number(e.target.value))} /></Field>
              <Field label="Acquisition stage">
                <select disabled={!canEdit} style={inputStyle} value={form.stageIndex} onChange={(e) => set("stageIndex", Number(e.target.value))}>
                  {STAGES.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}
                </select>
              </Field>
              <Field label="Families affected"><input disabled={!canEdit} type="number" style={inputStyle} value={form.familiesAffected} onChange={(e) => set("familiesAffected", Number(e.target.value))} /></Field>
              <Field label="Families pending comp."><input disabled={!canEdit} type="number" style={inputStyle} value={form.familiesPending} onChange={(e) => set("familiesPending", Number(e.target.value))} /></Field>
              <Field label="Avg. delay (days)"><input disabled={!canEdit} type="number" style={inputStyle} value={form.avgDelayDays} onChange={(e) => set("avgDelayDays", Number(e.target.value))} /></Field>
              <Field label="Ownership disputes"><input disabled={!canEdit} type="number" style={inputStyle} value={form.disputes} onChange={(e) => set("disputes", Number(e.target.value))} /></Field>
              <Field label="Court cases"><input disabled={!canEdit} type="number" style={inputStyle} value={form.courtCases} onChange={(e) => set("courtCases", Number(e.target.value))} /></Field>
              <Field label="Approval complete (%)"><input disabled={!canEdit} type="number" style={inputStyle} value={form.approvalPct} onChange={(e) => set("approvalPct", Number(e.target.value))} /></Field>
              <Field label="Documents missing"><input disabled={!canEdit} type="number" style={inputStyle} value={form.docsMissing} onChange={(e) => set("docsMissing", Number(e.target.value))} /></Field>
              <Field label="Resettlement (%)"><input disabled={!canEdit} type="number" style={inputStyle} value={form.resettlementPct} onChange={(e) => set("resettlementPct", Number(e.target.value))} /></Field>
              <Field label="Rehabilitation (%)"><input disabled={!canEdit} type="number" style={inputStyle} value={form.rehabPct} onChange={(e) => set("rehabPct", Number(e.target.value))} /></Field>
              <Field label="Departments involved"><input disabled={!canEdit} type="number" style={inputStyle} value={form.depts} onChange={(e) => set("depts", Number(e.target.value))} /></Field>
              <Field label="Prior delays"><input disabled={!canEdit} type="number" style={inputStyle} value={form.prevDelays} onChange={(e) => set("prevDelays", Number(e.target.value))} /></Field>
            </div>
            <Btn onClick={submitManual} disabled={!canEdit || saving} icon={Plus}>{saving ? "Saving…" : "Add project"}</Btn>
            {manualError && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded" style={{ background: C.highTint }}>
                <AlertTriangle size={14} color={C.high} /><span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.high }}>{manualError}</span>
              </div>
            )}
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>Risk score, explanation, alerts and map placement are calculated automatically once added.</div>
          </div>
        </Card>

        {/* File import */}
        <Card style={{ padding: 18 }}>
          <div className="flex items-center gap-2 mb-3"><UploadCloud size={16} color={C.primary} /><span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: C.ink }}>Import projects from a file</span></div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>
            Upload a <b>.csv</b> or <b>.json</b> file with one row per project. Column names should match the fields used in the manual form above.
          </p>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 mb-4" style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.primary, fontWeight: 600 }}>
            <Download size={13} /> Download CSV template
          </button>
          <div
            className="flex flex-col items-center justify-center gap-2 rounded"
            style={{ border: `1.5px dashed ${C.borderStrong}`, padding: "26px 16px", background: C.surfaceSunk, opacity: canEdit ? 1 : 0.6 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (canEdit && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <UploadCloud size={22} color={C.inkFaint} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>Drag a .csv or .json file here, or</span>
            <Btn small variant="subtle" disabled={!canEdit} onClick={() => fileInputRef.current?.click()}>Choose file</Btn>
            <input ref={fileInputRef} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>

          {importError && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded" style={{ background: C.highTint }}>
              <AlertTriangle size={14} color={C.high} /><span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.high }}>{importError}</span>
            </div>
          )}

          {importRows.length > 0 && (
            <div className="mt-4">
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>{importRows.length} project(s) ready to import:</div>
              <div className="flex flex-col gap-1 mb-3" style={{ maxHeight: 180, overflow: "auto" }}>
                {importRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded" style={{ background: C.surfaceSunk }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.ink }}>{r.name}</span>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkFaint }}>{r.district}, {r.state}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Btn onClick={confirmImport} disabled={saving} icon={UploadCloud}>{saving ? "Saving…" : `Import ${importRows.length} project${importRows.length === 1 ? "" : "s"}`}</Btn>
                <Btn variant="ghost" small onClick={() => setImportRows([])} icon={Trash2}>Discard</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   ROOT APP
   ============================================================ */
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, message: "" }; }
  static getDerivedStateFromError(error) { return { hasError: true, message: error?.message || "The application encountered an unexpected rendering error." }; }
  componentDidCatch(error) { console.error("BhoomiDrishti render error", error); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.bg, fontFamily: FONT_BODY }}>
        <div className="w-full max-w-xl rounded-xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(27,35,28,0.08)" }}>
          <div style={{ fontSize: 13, color: C.high, fontWeight: 800 }}>BhoomiDrishti encountered a rendering error</div>
          <div style={{ marginTop: 8, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>The application protected the session from a blank screen. Reload after checking the technical error.</div>
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: C.surfaceSunk, color: C.inkFaint, fontSize: 11, wordBreak: "break-word" }}>{this.state.message}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 14, background: C.primary, color: "#fff", border: 0, borderRadius: 7, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>Reload application</button>
        </div>
      </div>
    );
  }
}

class AIErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, message: "" }; }
  static getDerivedStateFromError(error) { return { hasError: true, message: error?.message || "Bhoomi AI page failed to render." }; }
  componentDidCatch(error) { console.error("Bhoomi AI render error", error); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-md p-6" style={{ background: C.surface, border: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
        <div style={{ fontSize: 12, color: C.high, fontWeight: 700 }}>Bhoomi AI could not render</div>
        <div style={{ marginTop: 6, color: C.ink, fontSize: 14 }}>The rest of BHOOMIDHRISTI is still available. Check the browser console for the technical error and refresh this page.</div>
        <button onClick={() => this.setState({ hasError: false, message: "" })} style={{ marginTop: 12, background: C.primary, color: "#fff", border: 0, borderRadius: 6, padding: "8px 12px", fontWeight: 700 }}>Retry</button>
      </div>
    );
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [mapFocusId, setMapFocusId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [aiProjectId, setAiProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [projectsUpdatedAt, setProjectsUpdatedAt] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [projectNavigationFilters, setProjectNavigationFilters] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.user && setUser(data.user))
      .catch(() => {});
  }, []);

  const reloadProjects = async ({initial=false}={}) => {
    if (!user) return;
    if (initial) setDataLoading(true);
    setDataError("");
    try {
      const r = await fetch("/api/projects", { credentials: "include", headers: { Accept: "application/json" } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `Project repository unavailable (${r.status}).`);
      setProjects(Array.isArray(body?.projects) ? body.projects : []); setProjectsUpdatedAt(new Date().toISOString());
    } catch(e) { setDataError(e?.message || "Unable to load the project repository."); } finally { if (initial) setDataLoading(false); }
  };

  useEffect(() => { if (!user) return; let cancelled=false; reloadProjects({initial:true}); const timer=setInterval(()=>{ if(!cancelled && document.visibilityState==='visible') reloadProjects(); },30000); return()=>{cancelled=true;clearInterval(timer);}; }, [user]);

  // Risk is calculated server-side by the persistent project repository.
  // The frontend only renders the returned representation.
  const scored = useMemo(() => projects, [projects]);
  const alertCount = useMemo(() => buildAlerts(scored).length, [scored]);
  const addProjects = async (newOnes) => {
    const added = [];
    for (const project of newOnes) {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "include",
        body: JSON.stringify(project),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to save project.");
      if (body?.project) added.push(body.project);
    }
    setProjects((prev) => [...added, ...prev]);
    return added;
  };

  const archiveProjectFromUI = async (project) => {
    if (!project?.id) return;
    const ok = window.confirm(`Remove "${String(project.name||'this project').replaceAll('"','\"')}" from the active portfolio?\n\nThis is a recoverable archive: evidence, history and audit records are preserved.`);
    if (!ok) return;
    const reason = window.prompt('Reason for removal (required for audit):', 'Unwanted / validation project removed from active portfolio');
    if (!reason || reason.trim().length < 5) { setDataError('A removal reason of at least 5 characters is required.'); return; }
    setDataError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { method:'DELETE', credentials:'include', headers:{'Accept':'application/json','Content-Type':'application/json'}, body:JSON.stringify({reason:reason.trim()}) });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(body?.error || 'Unable to remove project.');
      setProjects(current => current.filter(p => p.id !== project.id));
      if (selectedId === project.id) { setSelectedId(null); setView('projects'); }
      if (aiProjectId === project.id) setAiProjectId('');
      setProjectsUpdatedAt(new Date().toISOString());
    } catch(e) { setDataError(e?.message || 'Unable to remove project.'); }
  };

  if (!user) return <AppErrorBoundary><LoginPage onLogin={setUser} /></AppErrorBoundary>;

  if (dataLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: FONT_BODY }}>
      <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.inkSoft }}>Loading the authorised project repository…</div>
    </div>
  );

  const navigateToProjects = (filters = {}) => {
    setProjectNavigationFilters({...filters, _nonce: Date.now()});
    setSelectedId(null);
    setView("projects");
  };
  const openProject = (id) => { setSelectedId(id); setProjectNavigationFilters(null); setView("detail"); };
  const openProjectAI = (id) => { setAiProjectId(id); setView("chat"); setSelectedId(null); };
  const openProjectOnMap = (id) => { setMapFocusId(id); setSelectedId(null); setView("map"); };
  const handleLocationSaved = (updatedProject) => {
    if (!updatedProject?.id) return;
    setProjects((current) => current.map((p) => p.id === updatedProject.id ? updatedProject : p));
    setProjectsUpdatedAt(new Date().toISOString());
  };
  const selected = selectedId ? scored.find((p) => p.id === selectedId) : null;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setUser(null);
    setView("dashboard");
    setSelectedId(null);
    setAiProjectId('');
  };

  return (
    <AppErrorBoundary>
      <div className="flex" style={{ height: "100vh", width: "100%", background: C.bg, fontFamily: FONT_BODY }}>
      <FontLoader />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} setView={(v) => { setView(v); if (v !== "detail") setSelectedId(null); }} projects={scored} openProject={openProject} alertCount={alertCount} permissions={user.permissions || []} />
      <Sidebar view={view} setView={(v) => { setView(v); if (v !== "detail") setSelectedId(null); if (v !== "chat") setAiProjectId(''); }} role={user.role} permissions={user.permissions || []} onLogout={logout} alertCount={alertCount} publicDemo={Boolean(user.publicDemo)} />
      <div className="flex-1 bd-app-main">
        <div className="bd-workspace-bar">
          <div className="bd-workspace-context"><span className="bd-live-dot"/> <strong>{view === "dashboard" ? "Portfolio overview" : view === "detail" ? "Project workspace" : String(view).replaceAll("-", " ")}</strong><span className="bd-workspace-sep">/</span><span>Decision support</span></div>
          <div className="bd-workspace-actions">
            <span className="bd-updated">{projectsUpdatedAt ? `Updated ${new Date(projectsUpdatedAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "Repository connected"}</span>
            <button className="bd-search-trigger" onClick={() => setView("data-integration")} title="Open governed bulk data integration"><Database size={14}/> Bulk Integration</button>
            <button className="bd-search-trigger" onClick={() => setCommandOpen(true)}><Search size={14}/> Search <kbd>Ctrl K</kbd></button>
          </div>
        </div>
        <div className="px-7 py-6" style={{ maxWidth: 1760, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
           {user.publicDemo && <div className="mb-4 rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{background:"#EEF0EA",border:"1px solid #C4CABB",color:C.ink,fontFamily:FONT_BODY,fontSize:12}}>
             <div><strong>Public demonstration mode.</strong> Synthetic reference records only; read-only evaluation session. No government record or official decision is represented.</div>
             <button onClick={()=>setView("public-review")} className="rounded-md px-3 py-1.5" style={{background:C.primary,color:"#fff",fontWeight:800,fontSize:11}}>Give feedback</button>
           </div>}
          {view === "dashboard" && <Dashboard scored={scored} setView={setView} openProject={openProject} role={user.role} navigateToProjects={navigateToProjects} onRefresh={reloadProjects} />}
          {view === "projects" && <ProjectsPage scored={scored} openProject={openProject} openProjectAI={openProjectAI} onArchiveProject={archiveProjectFromUI} initialFilters={projectNavigationFilters} canManageProjects={(user.permissions || []).includes("projects:archive") || (user.permissions || []).includes("*")} />}
          {dataError && <div className="mb-4 rounded-lg px-4 py-3" style={{ background: C.highTint, border: `1px solid ${C.high}33`, color: C.high, fontFamily: FONT_BODY, fontSize: 12.5 }}>Project repository error: {dataError}</div>}
          {view === "add" && <AddProjectPage onAddProjects={addProjects} role={user.role} />}
          {view === "intake" && <ProjectIntakePage onOpenProject={openProject} canVerify={(user.permissions || []).includes("documents:verify") || (user.permissions || []).includes("*")} />}
          {view === "detail" && selected && <ProjectDetail project={selected} onBack={() => setView("projects")} onAskAI={openProjectAI} onOpenMap={openProjectOnMap} user={user} onLocationSaved={handleLocationSaved} />}
          {view === "map" && <RiskMap scored={scored} openProject={openProject} onRefresh={reloadProjects} focusProjectId={mapFocusId} onArchiveProject={archiveProjectFromUI} canManageProjects={(user.permissions || []).includes("projects:archive") || (user.permissions || []).includes("*")} lastUpdated={projectsUpdatedAt} />}
          {view === "alerts" && <AlertsPage scored={scored} openProject={openProject} />}
          {view === "operations" && <OperationsCenterPage scored={scored} />}
          {view === "national-intelligence" && <NationalIntelligencePage onOpenProject={openProject} />}
          {view === "predictive-lab" && <PredictiveLabPage onOpenProject={openProject} canAdmin={user.role === "Administrator" || (user.permissions || []).includes("workflow:admin")} />}
          {view === "history" && <HistoryPage scored={scored} openProject={openProject} />}
          {view === "feedback" && <FeedbackPage scored={scored} role={user.role} />}
          {view === "data-integration" && <DataIntegrationPage canAdmin={user.role === "Administrator" || (user.permissions || []).includes("workflow:admin")} onOpenProject={openProject} onOpenMap={openProjectOnMap} />}
          {view === "data-health" && <DataHealthPage canAdmin={user.role === "Administrator" || (user.permissions || []).includes("workflow:admin")} />}
          {view === "readiness" && <ProductionReadinessPage />}
          {view === "integrations" && <IntegrationControlPage canAdmin={user.role === "Administrator" || (user.permissions || []).includes("workflow:admin")} />}
           {view === "public-review" && user.publicDemo && <PublicReviewPage />}
          {view === "chat" && <AIErrorBoundary><BhoomiAIPage scored={scored} initialProjectId={aiProjectId} onClearProject={() => setAiProjectId('')} /></AIErrorBoundary>}
          {view === "admin" && <AdminAccessPage />}
        </div>
      </div>
    </div>
    </AppErrorBoundary>
  );
}

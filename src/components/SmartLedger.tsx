"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import type { Analysis, Finding, ZohoConnection } from "@/lib/types";
import { sleep, fmtDate, uid, LS, zohoFetch, callClaude, generateDemoJournals } from "@/lib/utils";

// ── Design tokens (CSS vars) ──────────────────────────────────────────────
const T = {
  surface:   "rgba(255,255,255,0.82)",
  border:    "rgba(10,10,15,0.06)",
  borderHov: "rgba(10,10,15,0.14)",
  text:      "#0a0a0f",
  muted:     "rgba(10,10,15,0.45)",
  hint:      "rgba(10,10,15,0.28)",
  purple:    "#8b18e8",
  teal:      "#17b8a5",
  blue:      "#2196f3",
  gradPM:    "linear-gradient(135deg,#8b18e8,#e010c8)",
  gradTB:    "linear-gradient(135deg,#17b8a5,#2196f3)",
} as const;

// ── Small shared components ───────────────────────────────────────────────

const RISK_CFG = {
  High:   { bg: "rgba(220,38,38,0.10)",  text: "#991b1b", dot: "#dc2626" },
  Medium: { bg: "rgba(234,88,12,0.10)",  text: "#9a3412", dot: "#ea580c" },
  Low:    { bg: "rgba(22,163,74,0.10)",  text: "#14532d", dot: "#16a34a" },
} as const;

function RiskBadge({ level }: { level: string }) {
  const c = RISK_CFG[level as keyof typeof RISK_CFG] ?? { bg: "rgba(10,10,15,0.08)", text: T.muted, dot: "#888" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c.bg, color:c.text, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, letterSpacing:0.3, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
      {level?.toUpperCase()}
    </span>
  );
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span style={{ display:"inline-block", width:size, height:size, border:"2px solid rgba(139,24,232,0.18)", borderTopColor:T.purple, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />
  );
}

function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div style={{ marginBottom:8 }}>
      {label && <div style={{ fontSize:12, color:T.muted, marginBottom:5 }}>{label}</div>}
      <div style={{ height:5, background:"rgba(10,10,15,0.07)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${value}%`, background:T.gradPM, borderRadius:3, transition:"width 0.45s ease" }} />
      </div>
    </div>
  );
}

function Card({ children, style = {}, onClick, accent, noPad }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  accent?: string;
  noPad?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true)  : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
      style={{ background:T.surface, border:`1px solid ${hovered && onClick ? T.borderHov : T.border}`, borderRadius:18, overflow:"hidden", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", transition:"transform 0.22s cubic-bezier(0.23,1,0.32,1), border-color 0.2s", transform: hovered && onClick ? "translateY(-2px)" : "none", cursor: onClick ? "pointer" : undefined, ...style }}
    >
      {accent && <div style={{ height:3, background:accent }} />}
      {noPad ? children : <div style={{ padding:"20px 24px" }}>{children}</div>}
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom:28 }}>
      <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em", margin:0, background:T.gradPM, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>{title}</h1>
      {subtitle && <p style={{ fontSize:14, color:T.muted, marginTop:5, marginBottom:0 }}>{subtitle}</p>}
    </div>
  );
}

function Pill({ children, color = "purple" }: { children: React.ReactNode; color?: "purple"|"teal"|"blue"|"amber" }) {
  const cfg = {
    purple: { bg:"rgba(139,24,232,0.10)", text:"#6b10b8" },
    teal:   { bg:"rgba(23,184,165,0.10)", text:"#0a7a6e" },
    blue:   { bg:"rgba(33,150,243,0.10)", text:"#0c447c" },
    amber:  { bg:"rgba(245,158,11,0.12)", text:"#92400e" },
  };
  const c = cfg[color];
  return <span style={{ display:"inline-block", background:c.bg, color:c.text, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>{children}</span>;
}

function AmbientBg() {
  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
      <div style={{ position:"absolute", width:580, height:580, top:-140, left:-100, borderRadius:"50%", background:"rgba(139,24,232,0.10)", filter:"blur(90px)", animation:"orb1 20s ease-in-out infinite" }} />
      <div style={{ position:"absolute", width:480, height:480, top:300, right:-140, borderRadius:"50%", background:"rgba(224,16,200,0.08)", filter:"blur(90px)", animation:"orb2 26s ease-in-out infinite" }} />
      <div style={{ position:"absolute", width:420, height:420, bottom:-100, left:"38%", borderRadius:"50%", background:"rgba(23,184,165,0.07)", filter:"blur(90px)", animation:"orb3 22s ease-in-out infinite" }} />
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.04 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hxbg" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
            <polygon points="14,2 42,2 56,26 42,46 14,46 0,26" fill="none" stroke="#0a0a0f" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hxbg)" />
      </svg>
    </div>
  );
}

// ── Finding card ─────────────────────────────────────────────────────────
function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border:`1px solid ${open ? "rgba(139,24,232,0.18)" : T.border}`, borderRadius:12, marginBottom:10, overflow:"hidden", background: open ? "rgba(139,24,232,0.025)" : T.surface, transition:"all 0.2s", backdropFilter:"blur(10px)" }}>
      <div onClick={() => setOpen(!open)} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 18px", cursor:"pointer" }}>
        <RiskBadge level={finding.severity} />
        <span style={{ flex:1, fontSize:13.5, color:T.text, fontWeight:500 }}>{finding.title}</span>
        <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize:14, color:T.hint }} />
      </div>
      {open && (
        <div style={{ padding:"0 18px 18px", borderTop:`1px solid ${T.border}` }}>
          <p style={{ fontSize:13, color:T.muted, marginTop:14, lineHeight:1.65 }}>{finding.description}</p>
          {(finding.affectedEntries?.length ?? 0) > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.purple, letterSpacing:0.8, marginBottom:6, textTransform:"uppercase" }}>Affected entries</div>
              {finding.affectedEntries!.slice(0, 5).map((e, i) => (
                <div key={i} style={{ fontSize:12, color:T.muted, padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>{e}</div>
              ))}
            </div>
          )}
          {finding.recommendation && (
            <div style={{ marginTop:14, padding:"12px 16px", background:"rgba(33,150,243,0.06)", border:"1px solid rgba(33,150,243,0.14)", borderRadius:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.blue, letterSpacing:0.8, marginBottom:5, textTransform:"uppercase" }}>Recommendation</div>
              <p style={{ fontSize:13, color:T.text, margin:0, lineHeight:1.6 }}>{finding.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════
export default function SmartLedger() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const [page, setPage] = useState<"dashboard"|"new-analysis"|"results"|"history"|"settings">("dashboard");
  const [connections, setConnections] = useState<ZohoConnection[]>([]);
  const [analyses, setAnalyses]  = useState<Analysis[]>(() => LS.get("sl_analyses", []));
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error"|"info" } | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const r = await fetch("/api/connections");
      if (r.ok) setConnections(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const addConn = useCallback(async (conn: Omit<ZohoConnection, "id">) => {
    const r = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conn),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed to add connection"); }
    await fetchConnections();
  }, [fetchConnections]);

  const removeConn = useCallback(async (id: string) => {
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const saveAnalyses  = useCallback((a: Analysis[])  => { setAnalyses(a);  LS.set("sl_analyses",  a); }, []);
  const notify = useCallback((msg: string, type: "success"|"error"|"info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4200);
  }, []);
  const viewAnalysis = useCallback((a: Analysis) => { setCurrentAnalysis(a); setPage("results"); }, []);

  const toastBg = { success:"rgba(22,163,74,0.96)", error:"rgba(220,38,38,0.96)", info:"rgba(37,99,235,0.94)" };

  return (
    <div style={{ minHeight:"100vh", background:"#f7f8ff", color:T.text, fontFamily:"'Inter',-apple-system,sans-serif", position:"relative" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes orb1 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(36px,-24px)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-28px,32px)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0)} 60%{transform:translate(22px,-18px)} }
      `}</style>
      <AmbientBg />
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999, padding:"12px 20px", borderRadius:12, background:toastBg[toast.type], color:"#fff", fontSize:13.5, fontWeight:500, animation:"fade-enter 0.3s", maxWidth:360, backdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.12)" }}>
          {toast.msg}
        </div>
      )}
      <div style={{ display:"flex", minHeight:"100vh", position:"relative", zIndex:1 }}>
        <Sidebar page={page} setPage={setPage as (p: string) => void} connections={connections} session={session} />
        <main style={{ flex:1, overflow:"auto", padding:"32px 36px" }}>
          {page === "dashboard"    && <Dashboard  analyses={analyses} connections={connections} setPage={setPage as (p: string) => void} viewAnalysis={viewAnalysis} notify={notify} />}
          {page === "new-analysis" && <NewAnalysis connections={connections} analyses={analyses} saveAnalyses={saveAnalyses} setPage={setPage as (p: string) => void} viewAnalysis={viewAnalysis} notify={notify} />}
          {page === "results"      && <ResultsViewer analysis={currentAnalysis} setPage={setPage as (p: string) => void} />}
          {page === "history"      && <History analyses={analyses} saveAnalyses={saveAnalyses} viewAnalysis={viewAnalysis} notify={notify} />}
          {page === "settings"     && <Settings connections={connections} addConn={addConn} removeConn={removeConn} isAdmin={isAdmin} notify={notify} />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════════════════
function Sidebar({ page, setPage, connections, session }: { page: string; setPage: (p: string) => void; connections: ZohoConnection[]; session: import("next-auth").Session | null }) {
  const nav = [
    { id:"dashboard",    label:"Dashboard",   icon:"ti-layout-dashboard" },
    { id:"new-analysis", label:"New analysis", icon:"ti-sparkles" },
    { id:"history",      label:"History",      icon:"ti-clock" },
    { id:"settings",     label:"Settings",     icon:"ti-settings" },
  ];
  const userName  = session?.user?.name  || session?.user?.email || "User";
  const userRole  = (session?.user as { role?: string })?.role ?? "user";
  return (
    <aside style={{ width:224, background:"rgba(255,255,255,0.65)", borderRight:`1px solid ${T.border}`, backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", padding:"22px 12px", flexShrink:0, position:"sticky", top:0, height:"100vh", zIndex:10 }}>
      <div style={{ padding:"4px 8px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:T.gradPM, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, fontWeight:800 }}>H</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, letterSpacing:"-0.01em" }}>SmartLedger</div>
            <div style={{ fontSize:10, color:T.hint, letterSpacing:"0.08em", fontWeight:600, textTransform:"uppercase" }}>by Hexa</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1, display:"flex", flexDirection:"column", gap:2 }}>
        {nav.map(item => (
          <button key={item.id} className={`nav-item${page === item.id || (page === "results" && item.id === "history") ? " active" : ""}`} onClick={() => setPage(item.id)}>
            <i className={`ti ${item.icon}`} style={{ fontSize:17, width:20, textAlign:"center" }} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:14, marginTop:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.hint, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10, paddingLeft:6 }}>Zoho connections</div>
        {connections.length === 0
          ? <div style={{ fontSize:12, color:T.hint, paddingLeft:6 }}>No connections yet</div>
          : connections.slice(0, 3).map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 6px", borderRadius:8 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
              <span style={{ fontSize:12, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.organizationName || c.organizationId}</span>
            </div>
          ))
        }
      </div>
      <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, marginTop:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 6px", marginBottom:8 }}>
          <div style={{ width:26, height:26, borderRadius:7, background:T.gradPM, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700, flexShrink:0 }}>
            {userName[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userName}</div>
            <div style={{ fontSize:10, color:T.hint, textTransform:"capitalize" }}>{userRole}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, background:"transparent", border:"none", cursor:"pointer", fontSize:12, color:T.muted, transition:"background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(10,10,15,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <i className="ti ti-logout" style={{ fontSize:15 }} aria-hidden="true" />Sign out
        </button>
      </div>
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
function Dashboard({ analyses, connections, setPage, viewAnalysis, notify }: {
  analyses: Analysis[]; connections: ZohoConnection[];
  setPage: (p: string) => void; viewAnalysis: (a: Analysis) => void; notify: (m: string, t?: "success"|"error"|"info") => void;
}) {
  const totalFindings = analyses.reduce((s, a) => s + (a.findingsCount || 0), 0);
  const highRisk = analyses.filter(a => a.riskScore === "High").length;
  const stats = [
    { label:"Total analyses", value: analyses.length,    icon:"ti-chart-bar",     color:T.purple },
    { label:"Total findings",  value: totalFindings,      icon:"ti-alert-triangle", color:"#ea580c" },
    { label:"High risk",       value: highRisk,           icon:"ti-shield-x",       color:"#dc2626" },
    { label:"Connections",     value: connections.length, icon:"ti-plug",           color:T.teal },
  ];
  return (
    <div className="page-enter">
      <PageHeader title="Dashboard" subtitle="AI-powered journal entry analysis — powered by Claude" />
      <div style={{ background:"rgba(139,24,232,0.06)", border:"1px solid rgba(139,24,232,0.15)", borderRadius:14, padding:"14px 20px", marginBottom:24, display:"flex", alignItems:"center", gap:14 }}>
        <i className="ti ti-brand-github" style={{ fontSize:20, color:T.purple }} aria-hidden="true" />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#4a0d8f" }}>Claude AI is your analysis engine</div>
          <div style={{ fontSize:13, color:"rgba(74,13,143,0.7)", marginTop:2 }}>Set <code style={{ background:"rgba(139,24,232,0.12)", padding:"1px 6px", borderRadius:4, fontSize:12 }}>ANTHROPIC_API_KEY</code> in <code style={{ background:"rgba(139,24,232,0.12)", padding:"1px 6px", borderRadius:4, fontSize:12 }}>.env.local</code> to enable analysis.</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:14, marginBottom:28 }}>
        {stats.map((s, i) => (
          <div key={s.label} className={`stagger-${i+1}`} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"18px 20px", backdropFilter:"blur(14px)" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <i className={`ti ${s.icon}`} style={{ fontSize:18, color:s.color }} aria-hidden="true" />
            </div>
            <div style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em", color:T.text }}>{s.value}</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:3, fontWeight:500 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:32 }}>
        <button className="btn-primary" onClick={() => setPage("new-analysis")}>
          <i className="ti ti-sparkles" style={{ fontSize:14 }} aria-hidden="true" />New analysis
        </button>
        <button className="btn-secondary" onClick={() => setPage("history")}>View history</button>
        <button className="btn-secondary" onClick={() => setPage("settings")}>Settings</button>
      </div>
      <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:14 }}>Recent analyses</div>
      {analyses.length === 0
        ? <Card>
          <div style={{ textAlign:"center", padding:"44px 0" }}>
            <div style={{ width:52, height:52, borderRadius:14, background:"rgba(139,24,232,0.08)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <i className="ti ti-chart-dots" style={{ fontSize:24, color:T.purple }} aria-hidden="true" />
            </div>
            <div style={{ fontSize:15, color:T.muted, marginBottom:20 }}>No analyses yet. Run your first to get started.</div>
            <button className="btn-primary" onClick={() => setPage("new-analysis")}>Start analysis</button>
          </div>
        </Card>
        : analyses.slice(0, 6).map(a => {
          const [hov, setHov] = useState(false);
          return (
            <div key={a.id} onClick={() => viewAnalysis(a)}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{ background:T.surface, border:`1px solid ${hov ? T.borderHov : T.border}`, borderRadius:14, padding:"15px 20px", marginBottom:10, display:"flex", alignItems:"center", gap:16, cursor:"pointer", backdropFilter:"blur(12px)", transition:"all 0.2s", transform: hov ? "translateY(-1px)" : "none" }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"rgba(139,24,232,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <i className="ti ti-report-analytics" style={{ fontSize:18, color:T.purple }} aria-hidden="true" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:3 }}>{a.organizationName}</div>
                <div style={{ fontSize:12, color:T.muted }}>{fmtDate(a.periodFrom)} — {fmtDate(a.periodTo)} · {a.totalEntries} entries · {fmtDate(a.createdAt)}</div>
                {a.modelUsed && <div style={{ fontSize:11, color:T.hint, marginTop:2 }}>via {a.modelUsed}</div>}
              </div>
              <RiskBadge level={a.riskScore} />
              <span style={{ fontSize:12, color:T.muted, whiteSpace:"nowrap" }}>{a.findingsCount} findings</span>
              <i className="ti ti-chevron-right" style={{ fontSize:14, color:T.hint }} aria-hidden="true" />
            </div>
          );
        })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// NEW ANALYSIS
// ══════════════════════════════════════════════════════════════════════════
const SECTION_KEYS = ["completeness","anomalies","duplicates","period","compliance"] as const;

function NewAnalysis({ connections, analyses, saveAnalyses, setPage, viewAnalysis, notify }: {
  connections: ZohoConnection[]; analyses: Analysis[]; saveAnalyses: (a: Analysis[]) => void;
  setPage: (p: string) => void; viewAnalysis: (a: Analysis) => void;
  notify: (m: string, t?: "success"|"error"|"info") => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedConn, setSelectedConn] = useState<ZohoConnection | null>(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear()-1); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [scope, setScope] = useState("all");
  const [amtThreshold, setAmtThreshold] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploadedData, setUploadedData] = useState<Record<string,string>[] | null>(null);
  const [useManual, setUseManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fyPresets = [
    { label:"This FY", from:`${new Date().getFullYear()-(new Date().getMonth()<3?1:0)}-01-01`, to:new Date().toISOString().split("T")[0] },
    { label:"Last FY", from:`${new Date().getFullYear()-1}-01-01`, to:`${new Date().getFullYear()-1}-12-31` },
    { label:"Last 6M", from:new Date(Date.now()-180*86400000).toISOString().split("T")[0], to:new Date().toISOString().split("T")[0] },
    { label:"Last Q",  from:new Date(Date.now()-90*86400000).toISOString().split("T")[0],  to:new Date().toISOString().split("T")[0] },
  ];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const rows = lines.slice(1).map(l => {
      const cells = l.split(",").map(c => c.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    });
    setUploadedData(rows);
    notify(`Loaded ${rows.length} entries from ${file.name}`, "success");
  };

  const runAnalysis = async () => {
    if (!useManual && !selectedConn) { notify("Please select a Zoho connection.", "error"); return; }
    setRunning(true); setProgress(0);

    try {
      let journals: unknown[] = [];
      let orgName = "Manual Upload";

      if (useManual && uploadedData) {
        journals = uploadedData;
        setProgress(20); setProgressLabel("Loaded manual data…");
      } else if (selectedConn) {
        setProgressLabel("Connecting to Zoho Books…"); setProgress(10);
        orgName = selectedConn.organizationName || selectedConn.organizationId;
        setProgressLabel("Fetching journal entries…"); setProgress(20);
        try {
          const resp = await zohoFetch(selectedConn.accessToken, selectedConn.region, selectedConn.organizationId, "/journals", { date_start:dateFrom, date_end:dateTo, per_page:"200" });
          journals = (resp.journals as unknown[]) || [];
        } catch {
          notify("Zoho fetch failed — using demo data for analysis.", "info");
          journals = generateDemoJournals(60);
        }
        setProgress(40); setProgressLabel(`Fetched ${journals.length} journal entries…`);
      }

      if (journals.length > 500) journals = journals.slice(0, 500);

      setProgress(48); setProgressLabel("Starting Claude AI analysis…");
      await sleep(200);

      // Run all 5 sections through Claude API
      const sections: Analysis["sections"] = { completeness:[], anomalies:[], duplicates:[], period:[], compliance:[] };
      const sectionProgress = [55, 64, 73, 82, 90];

      for (let i = 0; i < SECTION_KEYS.length; i++) {
        const key = SECTION_KEYS[i];
        setProgressLabel(`Claude: analyzing ${key}…`);
        setProgress(sectionProgress[i]);
        const findings = await callClaude(journals.slice(0, 100), key, "section");
        (sections as unknown as Record<string, Finding[]>)[key] = Array.isArray(findings) ? findings as Finding[] : [];
        await sleep(100);
      }

      setProgressLabel("Claude: generating executive summary…"); setProgress(94);
      const allFindings = Object.values(sections).flat();
      const highCount = allFindings.filter(f => f.severity === "High").length;
      const riskScore: "High"|"Medium"|"Low" = highCount >= 3 ? "High" : highCount >= 1 ? "Medium" : "Low";

      const summaryResult = await callClaude(
        journals.slice(0, 10), // minimal payload for summary
        JSON.stringify({ findingCounts:{ High:highCount, Medium:allFindings.filter(f=>f.severity==="Medium").length, Low:allFindings.filter(f=>f.severity==="Low").length }, topFindings:allFindings.slice(0,5).map(f=>({title:f.title,severity:f.severity})), riskScore }),
        "summary"
      );

      const summary = (summaryResult && typeof summaryResult === "object") ? summaryResult as Analysis["summary"] : {
        overallRiskScore: riskScore, executiveSummary: "Analysis complete.", topRecommendations:[], immediateActions:[], top10Findings:[],
      };

      setProgress(100); setProgressLabel("Analysis complete!"); await sleep(400);

      const newAnalysis: Analysis = {
        id: uid(), organizationName: orgName, periodFrom: dateFrom, periodTo: dateTo,
        createdAt: new Date().toISOString(), status: "complete",
        totalEntries: journals.length, findingsCount: allFindings.length,
        riskScore, sections, summary,
        modelUsed: "claude-sonnet-4-6",
      };

      saveAnalyses([newAnalysis, ...analyses]);
      notify("Analysis complete!", "success");
      setRunning(false);
      viewAnalysis(newAnalysis);
    } catch (err: unknown) {
      setRunning(false);
      notify(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const stepLabels = ["Data source", "Date range", "Scope", "Run"];

  return (
    <div className="page-enter" style={{ maxWidth:700 }}>
      <PageHeader title="New analysis" subtitle="Configure and run Claude-powered journal entry analysis" />

      {/* Step indicator */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:32 }}>
        {stepLabels.map((lbl, i) => {
          const s = i+1; const done = s < step; const active = s === step;
          return (
            <div key={s} style={{ display:"flex", alignItems:"center", flex:1 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background: done||active ? T.gradPM : "rgba(10,10,15,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color: done||active ? "#fff" : T.muted, transition:"all 0.3s" }}>
                  {done ? <i className="ti ti-check" style={{ fontSize:13 }} aria-hidden="true" /> : s}
                </div>
                <span style={{ fontSize:11, color: active ? T.purple : T.hint, fontWeight: active ? 600 : 400, whiteSpace:"nowrap" }}>{lbl}</span>
              </div>
              {s < 4 && <div style={{ flex:1, height:2, background: done ? T.gradPM : "rgba(10,10,15,0.08)", marginBottom:18, transition:"all 0.3s" }} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Card accent={T.gradPM}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:20, color:T.text }}>Select data source</div>
          <div style={{ display:"flex", gap:10, marginBottom:22 }}>
            <button onClick={() => setUseManual(false)} className={useManual ? "btn-secondary" : "btn-primary"} style={{ flex:1, justifyContent:"center" }}>
              <i className="ti ti-cloud" style={{ fontSize:14 }} aria-hidden="true" />Zoho Books
            </button>
            <button onClick={() => setUseManual(true)} className={useManual ? "btn-primary" : "btn-secondary"} style={{ flex:1, justifyContent:"center" }}>
              <i className="ti ti-upload" style={{ fontSize:14 }} aria-hidden="true" />Manual CSV
            </button>
          </div>
          {!useManual
            ? connections.length === 0
              ? <div style={{ textAlign:"center", padding:"36px 20px" }}>
                <i className="ti ti-plug-x" style={{ fontSize:36, color:T.hint, display:"block", marginBottom:12 }} aria-hidden="true" />
                <div style={{ fontSize:14, color:T.muted }}>No Zoho connections found. Add one in Settings first.</div>
              </div>
              : connections.map(c => (
                <div key={c.id} onClick={() => setSelectedConn(c)} style={{ padding:"14px 18px", border:`1.5px solid ${selectedConn?.id === c.id ? T.purple : T.border}`, borderRadius:12, marginBottom:10, cursor:"pointer", background: selectedConn?.id === c.id ? "rgba(139,24,232,0.05)" : "rgba(255,255,255,0.5)", transition:"all 0.18s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:9, height:9, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{c.organizationName || c.organizationId}</div>
                      <div style={{ fontSize:12, color:T.muted }}>{c.region} · {c.currency}</div>
                    </div>
                    {selectedConn?.id === c.id && <Pill color="purple">Selected</Pill>}
                  </div>
                </div>
              ))
            : <div>
              <div onClick={() => fileRef.current?.click()} style={{ border:`2px dashed ${T.border}`, borderRadius:14, padding:"44px 24px", textAlign:"center", cursor:"pointer", background:"rgba(255,255,255,0.4)", transition:"border-color 0.18s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.purple)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                <i className="ti ti-file-spreadsheet" style={{ fontSize:36, color:T.hint, display:"block", marginBottom:10 }} aria-hidden="true" />
                <div style={{ fontSize:14, color:T.muted }}>Click to upload CSV</div>
                <div style={{ fontSize:12, color:T.hint, marginTop:4 }}>Columns: Date, Journal#, Account, Debit, Credit, Description</div>
                {uploadedData && <div style={{ marginTop:12 }}><Pill color="teal">✓ {uploadedData.length} entries loaded</Pill></div>}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={handleFile} />
            </div>
          }
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:24 }}>
            <button className="btn-primary" onClick={() => {
              if (!useManual && !selectedConn) { notify("Please select a connection", "error"); return; }
              if (useManual && !uploadedData) { notify("Please upload a file", "error"); return; }
              setStep(2);
            }}>Next →</button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card accent={T.gradPM}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:20, color:T.text }}>Select date range</div>
          <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
            {fyPresets.map(p => <button key={p.label} className="btn-secondary" style={{ fontSize:12, padding:"6px 14px" }} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}>{p.label}</button>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
            <div><label>From date</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div><label>To date</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Next →</button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card accent={T.gradPM}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:20, color:T.text }}>Analysis scope</div>
          {[
            { id:"all",       label:"All journal entries",    desc:"Analyze every journal entry in the selected period" },
            { id:"threshold", label:"Amount threshold",       desc:"Only analyze entries above a specified amount" },
            { id:"accounts",  label:"Specific account codes", desc:"Focus on specific chart of account codes" },
          ].map(s => (
            <div key={s.id} onClick={() => setScope(s.id)} style={{ padding:"14px 18px", border:`1.5px solid ${scope === s.id ? T.purple : T.border}`, borderRadius:12, marginBottom:10, cursor:"pointer", background: scope === s.id ? "rgba(139,24,232,0.05)" : "rgba(255,255,255,0.5)", transition:"all 0.18s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${scope === s.id ? T.purple : "rgba(10,10,15,0.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {scope === s.id && <div style={{ width:8, height:8, borderRadius:"50%", background:T.purple }} />}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:T.text }}>{s.label}</div>
                  <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
          {scope === "threshold" && (
            <div style={{ marginTop:14 }}><label>Minimum amount ({selectedConn?.currency || "USD"})</label><input type="number" placeholder="e.g. 10000" value={amtThreshold} onChange={e => setAmtThreshold(e.target.value)} /></div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
            <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn-primary" onClick={() => setStep(4)}>Next →</button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card accent={T.gradPM}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:20, color:T.text }}>Review & run</div>
          <div style={{ background:"rgba(139,24,232,0.04)", border:"1px solid rgba(139,24,232,0.10)", borderRadius:12, padding:"16px 20px", marginBottom:24 }}>
            {[
              { label:"Source",   value: useManual ? `Manual upload (${uploadedData?.length} entries)` : (selectedConn?.organizationName || selectedConn?.organizationId) },
              { label:"Period",   value: `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` },
              { label:"Scope",    value: scope === "all" ? "All journal entries" : scope === "threshold" ? `Entries ≥ ${amtThreshold}` : "Specific accounts" },
              { label:"AI engine",value: "Claude (claude-sonnet-4-6)" },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.border}`, fontSize:13.5 }}>
                <span style={{ color:T.muted }}>{r.label}</span>
                <span style={{ fontWeight:500, color:T.text }}>{r.value}</span>
              </div>
            ))}
          </div>
          {running
            ? <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <Spinner /><span style={{ fontSize:13, color:T.muted }}>{progressLabel}</span>
              </div>
              <ProgressBar value={progress} />
              <div style={{ fontSize:12, color:T.hint, marginTop:8 }}>Analyzing with Claude AI — this may take 30–90 seconds…</div>
            </div>
            : <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary" style={{ padding:"12px 32px", fontSize:15 }} onClick={runAnalysis}>
                <i className="ti ti-sparkles" style={{ fontSize:16 }} aria-hidden="true" />Run Claude analysis
              </button>
            </div>
          }
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// RESULTS VIEWER
// ══════════════════════════════════════════════════════════════════════════
const SECTIONS = [
  { id:"completeness", label:"Completeness" },
  { id:"anomalies",    label:"Anomalies" },
  { id:"duplicates",   label:"Duplicates" },
  { id:"period",       label:"Period-End" },
  { id:"compliance",   label:"Compliance" },
];

function ResultsViewer({ analysis, setPage }: { analysis: Analysis | null; setPage: (p: string) => void }) {
  const [activeTab, setActiveTab] = useState("summary");
  if (!analysis) return <div style={{ color:T.muted }}>No analysis selected.</div>;
  const { sections = {} as Analysis["sections"], summary = {} as Analysis["summary"] } = analysis;
  const allF = Object.values(sections).flat() as Finding[];
  const highN = allF.filter(f => f.severity === "High").length;
  const medN  = allF.filter(f => f.severity === "Medium").length;
  const lowN  = allF.filter(f => f.severity === "Low").length;

  return (
    <div className="page-enter">
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:26 }}>
        <button className="btn-secondary" style={{ padding:"8px 14px", fontSize:13 }} onClick={() => setPage("history")}>
          <i className="ti ti-arrow-left" style={{ fontSize:13 }} aria-hidden="true" />Back
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.02em", color:T.text }}>{analysis.organizationName}</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>
            {fmtDate(analysis.periodFrom)} — {fmtDate(analysis.periodTo)} · {analysis.totalEntries} entries · {fmtDate(analysis.createdAt)}
            {analysis.modelUsed && ` · ${analysis.modelUsed}`}
          </div>
        </div>
        <RiskBadge level={analysis.riskScore} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12, marginBottom:24 }}>
        {[
          { label:"Total findings", value:allF.length, color:T.purple },
          { label:"High risk",      value:highN,        color:"#dc2626" },
          { label:"Medium risk",    value:medN,         color:"#ea580c" },
          { label:"Low risk",       value:lowN,         color:"#16a34a" },
        ].map(s => (
          <div key={s.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"14px 18px", backdropFilter:"blur(12px)" }}>
            <div style={{ fontSize:24, fontWeight:700, color:s.color, letterSpacing:"-0.03em" }}>{s.value}</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:4, marginBottom:20, flexWrap:"wrap", background:"rgba(10,10,15,0.04)", padding:"4px", borderRadius:11, width:"fit-content" }}>
        <button className={`tab${activeTab === "summary" ? " active" : ""}`} onClick={() => setActiveTab("summary")}>Summary</button>
        {SECTIONS.map(s => (
          <button key={s.id} className={`tab${activeTab === s.id ? " active" : ""}`} onClick={() => setActiveTab(s.id)}>{s.label}</button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div className="fade-enter">
          <Card accent={T.gradPM} style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.purple, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Executive summary</div>
            <p style={{ fontSize:14, color:T.muted, lineHeight:1.7 }}>{summary.executiveSummary || "Analysis complete. Review findings in each section."}</p>
          </Card>
          {summary.topRecommendations?.length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.blue, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.06em" }}>Top recommendations</div>
              {summary.topRecommendations.map((r, i) => (
                <div key={i} style={{ display:"flex", gap:12, padding:"9px 0", borderBottom:`1px solid ${T.border}`, alignItems:"flex-start" }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:"rgba(33,150,243,0.10)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:T.blue, flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <span style={{ fontSize:13.5, color:T.text, lineHeight:1.55 }}>{r}</span>
                </div>
              ))}
            </Card>
          )}
          {summary.immediateActions?.length > 0 && (
            <Card style={{ background:"rgba(220,38,38,0.03)", borderColor:"rgba(220,38,38,0.12)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#dc2626", marginBottom:14, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                <i className="ti ti-bolt" style={{ marginRight:5, fontSize:13 }} aria-hidden="true" />Immediate actions required
              </div>
              {summary.immediateActions.map((a, i) => (
                <div key={i} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:"1px solid rgba(220,38,38,0.08)", alignItems:"flex-start" }}>
                  <i className="ti ti-arrow-right" style={{ fontSize:14, color:"#dc2626", marginTop:1, flexShrink:0 }} aria-hidden="true" />
                  <span style={{ fontSize:13.5, color:T.text }}>{a}</span>
                </div>
              ))}
            </Card>
          )}
          {summary.top10Findings?.length > 0 && (
            <Card style={{ marginTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>Top findings by severity</div>
              {summary.top10Findings.map(f => (
                <div key={f.rank} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:"rgba(10,10,15,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:T.muted, flexShrink:0 }}>{f.rank}</div>
                  <RiskBadge level={f.severity} />
                  <span style={{ flex:1, fontSize:13.5, color:T.text }}>{f.title}</span>
                  <span style={{ fontSize:12, color:T.hint }}>{f.impact}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {activeTab !== "summary" && (
        <div className="fade-enter">
          <div style={{ fontSize:13, color:T.muted, marginBottom:14 }}>{((sections as unknown as Record<string, Finding[]>)[activeTab] || []).length} findings in this section</div>
          {((sections as unknown as Record<string, Finding[]>)[activeTab] || []).length === 0
            ? <Card><div style={{ textAlign:"center", padding:"44px 0" }}>
              <i className="ti ti-circle-check" style={{ fontSize:36, color:"#16a34a", display:"block", marginBottom:10 }} aria-hidden="true" />
              <div style={{ fontSize:14, color:T.muted }}>No issues detected in this section.</div>
            </div></Card>
            : ((sections as unknown as Record<string, Finding[]>)[activeTab] || []).map((f, i) => <FindingCard key={i} finding={f} />)
          }
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════════════════════
function History({ analyses, saveAnalyses, viewAnalysis, notify }: {
  analyses: Analysis[]; saveAnalyses: (a: Analysis[]) => void;
  viewAnalysis: (a: Analysis) => void; notify: (m: string, t?: "success"|"error"|"info") => void;
}) {
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("all");
  const filtered = analyses.filter(a => {
    const ms = !search || a.organizationName?.toLowerCase().includes(search.toLowerCase());
    const mr = filterRisk === "all" || a.riskScore === filterRisk;
    return ms && mr;
  });
  const del = (id: string) => { saveAnalyses(analyses.filter(a => a.id !== id)); notify("Analysis deleted.", "info"); };
  return (
    <div className="page-enter">
      <PageHeader title="History" subtitle={`${analyses.length} total analyses`} />
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <div style={{ flex:1, position:"relative" }}>
          <i className="ti ti-search" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:15, color:T.hint, pointerEvents:"none", zIndex:1 }} aria-hidden="true" />
          <input placeholder="Search by organization…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:38 }} />
        </div>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ width:160 }}>
          <option value="all">All risk levels</option>
          <option value="High">High risk</option>
          <option value="Medium">Medium risk</option>
          <option value="Low">Low risk</option>
        </select>
      </div>
      {filtered.length === 0
        ? <Card><div style={{ textAlign:"center", padding:"52px 0" }}>
          <i className="ti ti-history" style={{ fontSize:36, color:T.hint, display:"block", marginBottom:12 }} aria-hidden="true" />
          <div style={{ fontSize:14, color:T.muted }}>No analyses found.</div>
        </div></Card>
        : filtered.map(a => {
          const [hov, setHov] = useState(false);
          return (
            <div key={a.id}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{ background:T.surface, border:`1px solid ${hov ? T.borderHov : T.border}`, borderRadius:14, padding:"15px 20px", marginBottom:10, display:"flex", alignItems:"center", gap:14, backdropFilter:"blur(12px)", transition:"all 0.2s" }}>
              <div style={{ flex:1, cursor:"pointer", minWidth:0 }} onClick={() => viewAnalysis(a)}>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:3 }}>{a.organizationName}</div>
                <div style={{ fontSize:12, color:T.muted }}>{fmtDate(a.periodFrom)} — {fmtDate(a.periodTo)} · {a.totalEntries} entries · {fmtDate(a.createdAt)}</div>
                {a.modelUsed && <div style={{ fontSize:11, color:T.hint, marginTop:1 }}>via {a.modelUsed}</div>}
              </div>
              <RiskBadge level={a.riskScore} />
              <span style={{ fontSize:12, color:T.muted, whiteSpace:"nowrap" }}>{a.findingsCount} findings</span>
              <button className="btn-secondary" style={{ fontSize:12, padding:"6px 14px", whiteSpace:"nowrap" }} onClick={() => viewAnalysis(a)}>View</button>
              <button className="btn-danger" onClick={() => del(a.id)}>Delete</button>
            </div>
          );
        })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════
function Settings({ connections, addConn, removeConn, isAdmin, notify }: {
  connections: ZohoConnection[];
  addConn: (conn: Omit<ZohoConnection, "id">) => Promise<void>;
  removeConn: (id: string) => Promise<void>;
  isAdmin: boolean;
  notify: (m: string, t?: "success"|"error"|"info") => void;
}) {
  const blank = { organizationId:"", organizationName:"", accessToken:"", refreshToken:"", region:".com", currency:"USD" };
  const [conn, setConn] = useState(blank);
  const [testing, setTesting] = useState(false);
  const [adding, setAdding]   = useState(false);

  const testZoho = async () => {
    if (!conn.accessToken) { notify("Please enter an Access Token.", "error"); return; }
    setTesting(true);
    try {
      const r = await fetch("/api/zoho-test", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken:conn.accessToken, region:conn.region, organizationId:conn.organizationId }) });
      const d = await r.json();
      if (d.organizations?.length > 0) notify(`Connected! Found ${d.organizations.length} organization(s).`, "success");
      else if (d.error) notify("Connection failed: " + d.error, "error");
      else notify("Connected but no organizations found.", "info");
    } catch (e: unknown) {
      notify("Connection test failed: " + (e instanceof Error ? e.message : String(e)), "error");
    }
    setTesting(false);
  };

  const handleAdd = async () => {
    if (!conn.organizationId && !conn.organizationName) { notify("Please enter an Organization ID or Name.", "error"); return; }
    if (!conn.accessToken) { notify("Please enter an Access Token.", "error"); return; }
    setAdding(true);
    try {
      await addConn(conn);
      setConn(blank);
      notify("Zoho connection added!", "success");
    } catch (e: unknown) {
      notify("Failed: " + (e instanceof Error ? e.message : String(e)), "error");
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await removeConn(id);
      notify("Connection removed.", "info");
    } catch {
      notify("Failed to remove connection.", "error");
    }
  };

  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <PageHeader title="Settings" subtitle="Configure Zoho Books connections and API integration" />

      {/* Claude info */}
      <Card accent={T.gradPM} style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 }}>Claude AI engine</div>
        <div style={{ fontSize:13, color:T.muted, marginBottom:14 }}>SmartLedger uses <strong>Claude (claude-sonnet-4-6)</strong> via your <code style={{ background:"rgba(139,24,232,0.10)", padding:"1px 6px", borderRadius:4, fontSize:12 }}>ANTHROPIC_API_KEY</code> environment variable.</div>
        <div style={{ background:"rgba(139,24,232,0.05)", border:"1px solid rgba(139,24,232,0.12)", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.purple, marginBottom:8 }}>Setup instructions</div>
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>
            1. Copy <code style={{ background:"rgba(10,10,15,0.06)", padding:"1px 5px", borderRadius:4 }}>.env.local.example</code> to <code style={{ background:"rgba(10,10,15,0.06)", padding:"1px 5px", borderRadius:4 }}>.env.local</code><br/>
            2. Add your key: <code style={{ background:"rgba(10,10,15,0.06)", padding:"1px 5px", borderRadius:4 }}>ANTHROPIC_API_KEY=sk-ant-...</code><br/>
            3. Restart the dev server: <code style={{ background:"rgba(10,10,15,0.06)", padding:"1px 5px", borderRadius:4 }}>npm run dev</code><br/>
            4. Get your key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color:T.blue }}>console.anthropic.com</a>
          </div>
        </div>
      </Card>

      {/* Zoho connection — admin only */}
      {isAdmin ? (
        <Card accent={T.gradTB} style={{ marginBottom:20 }}>
          <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 }}>Add Zoho Books connection</div>
          <div style={{ fontSize:13, color:T.muted, marginBottom:20 }}>Add your Zoho Books OAuth credentials. Get an Access Token from the <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer" style={{ color:T.blue }}>Zoho API Console</a>.</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
            <div><label>Organization name</label><input placeholder="My Company Pte Ltd" value={conn.organizationName} onChange={e => setConn({...conn, organizationName:e.target.value})} /></div>
            <div><label>Organization ID</label><input placeholder="12345678" value={conn.organizationId} onChange={e => setConn({...conn, organizationId:e.target.value})} /></div>
            <div><label>Access token</label><input type="password" placeholder="1000.xxx…" value={conn.accessToken} onChange={e => setConn({...conn, accessToken:e.target.value})} /></div>
            <div><label>Region</label>
              <select value={conn.region} onChange={e => setConn({...conn, region:e.target.value})}>
                <option value=".com">Global (.com)</option>
                <option value=".in">India (.in)</option>
                <option value=".com.au">Australia (.com.au)</option>
                <option value=".eu">Europe (.eu)</option>
                <option value=".jp">Japan (.jp)</option>
              </select>
            </div>
            <div><label>Currency</label><input placeholder="USD" value={conn.currency} onChange={e => setConn({...conn, currency:e.target.value})} /></div>
            <div><label>Refresh token (optional)</label><input type="password" placeholder="1000.xxx…" value={conn.refreshToken} onChange={e => setConn({...conn, refreshToken:e.target.value})} /></div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn-secondary" onClick={testZoho} disabled={testing} style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              {testing ? <><Spinner size={14} />Testing…</> : <><i className="ti ti-plug" style={{ fontSize:14 }} aria-hidden="true" />Test connection</>}
            </button>
            <button className="btn-primary" onClick={handleAdd} disabled={adding} style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              {adding ? <><Spinner size={14} />Adding…</> : "Add connection"}
            </button>
          </div>
        </Card>
      ) : (
        <div style={{ background:"rgba(10,10,15,0.04)", border:`1px solid ${T.border}`, borderRadius:14, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <i className="ti ti-lock" style={{ fontSize:18, color:T.hint }} aria-hidden="true" />
          <div style={{ fontSize:13, color:T.muted }}>Only admins can add or remove Zoho connections.</div>
        </div>
      )}

      <Card>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:16 }}>Connected organizations</div>
        {connections.length === 0
          ? <div style={{ textAlign:"center", padding:"32px 0" }}>
              <i className="ti ti-plug-x" style={{ fontSize:32, color:T.hint, display:"block", marginBottom:10 }} aria-hidden="true" />
              <div style={{ fontSize:13, color:T.muted }}>No organizations connected yet.</div>
            </div>
          : connections.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#16a34a", flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{c.organizationName || c.organizationId}</div>
                <div style={{ fontSize:12, color:T.muted }}>ID: {c.organizationId} · {c.region} · {c.currency}</div>
              </div>
              {isAdmin && <button className="btn-danger" onClick={() => handleRemove(c.id)}>Remove</button>}
            </div>
          ))
        }
      </Card>
    </div>
  );
}

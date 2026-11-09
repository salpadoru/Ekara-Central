"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/global-search";
import { Activity, ArrowUpRight, BookOpen, Bot, Building2, CheckCircle2, ChevronRight, CircleHelp, Clock3, Code2, FileText, FolderKanban, Gauge, Globe, HardDrive, Lightbulb, LifeBuoy, Plus, Search, Server, ShieldCheck, Sparkles, Users, Wrench } from "lucide-react";

type Section = "Dashboard" | "Customers" | "Projects" | "Knowledge Base";
const solutions = [
  { title: "Website outage — initial checks", description: "Check DNS, hosting status, SSL expiry, server health and recent deployments.", category: "Runbook", source: "Operations knowledge", keywords: "website down outage unavailable dns hosting ssl server" },
  { title: "Recover a WordPress website", description: "Review hosting access, error logs, plugins, backups and recovery steps.", category: "Guide", source: "Website support", keywords: "wordpress hacked recovery website compromised restore backup" },
  { title: "Deploy a website update", description: "Find the repository, deployment workflow, environment settings and rollback steps.", category: "Procedure", source: "Developer handover", keywords: "update deploy release code github git repository source rollback" },
  { title: "Database connection troubleshooting", description: "Verify database host, network access, credentials reference and service status.", category: "Troubleshooting", source: "Platform operations", keywords: "database connection error server postgres supabase" },
  { title: "Locate project access information", description: "Find approved access instructions and secure vault references for a project.", category: "How-to", source: "Access management", keywords: "username password credentials login access vault server" },
];
const customers = [
  { name: "Aroha Community Trust", contact: "Mereana Rangi · mereana@aroha.org.nz", projects: 2, status: "Active", initials: "AC", color: "#e8f1ff", ink: "#3565c8" },
  { name: "Foxton War Memorial Hall", contact: "Hall Committee · admin@foxtonhall.nz", projects: 1, status: "Active", initials: "FW", color: "#e8f7ef", ink: "#27835f" },
  { name: "North Harbour Services", contact: "James Patel · james@northharbour.nz", projects: 3, status: "Review", initials: "NH", color: "#fff2df", ink: "#b57b21" },
];
const projects = [
  { name: "Aroha public website", customer: "Aroha Community Trust", type: "Website · Next.js", status: "Active", initials: "AW", color: "#e8f1ff", ink: "#3565c8" },
  { name: "Foxton Hall website", customer: "Foxton War Memorial Hall", type: "Website · WordPress", status: "Active", initials: "FH", color: "#e8f7ef", ink: "#27835f" },
  { name: "North Harbour portal", customer: "North Harbour Services", type: "Web application", status: "Review", initials: "NP", color: "#fff2df", ink: "#b57b21" },
];
const articles = [
  { title: "Website outage — initial checks", desc: "A repeatable first-response checklist for a site that is unavailable.", type: "Runbook", updated: "Reviewed 2 days ago", icon: Server },
  { title: "Deploy a website update", desc: "Repository, build, deployment and rollback guidance for supported projects.", type: "Procedure", updated: "Reviewed last week", icon: Code2 },
  { title: "Emergency developer handover", desc: "Where to find infrastructure, source code, access and recovery details.", type: "Guide", updated: "Reviewed 3 weeks ago", icon: ShieldCheck },
  { title: "Database connection troubleshooting", desc: "Common connectivity checks and escalation information.", type: "Troubleshooting", updated: "Reviewed last month", icon: HardDrive },
];

export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login?setup=missing");
      return;
    }
    let active = true;
    const loadProfile = async (userId: string, email: string) => {
      setUserEmail(email);
      const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (!active) return;
      setUserRole(data?.role ?? "member");
      setAuthReady(true);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      void loadProfile(data.session.user.id, data.session.user.email ?? "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);
  const [section, setSection] = useState<Section>("Dashboard");
  const [query, setQuery] = useState("");
  const [selectedSolution, setSelectedSolution] = useState<(typeof solutions)[number] | null>(null);
  const [filter, setFilter] = useState("");
  const matches = useMemo(() => query.trim() ? solutions.filter(s => (s.title + " " + s.description + " " + s.keywords).toLowerCase().includes(query.toLowerCase())) : [], [query]);
  const nav = [{ label: "Dashboard" as Section, icon: Gauge }, { label: "Customers" as Section, icon: Building2 }, { label: "Projects" as Section, icon: FolderKanban }, { label: "Knowledge Base" as Section, icon: BookOpen }];
  const goSearch = (text: string) => { setQuery(text); setSelectedSolution(null); setSection("Dashboard"); };
  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
  };
  if (!authReady) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#647184" }}>Loading your Ekara workspace…</div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">E</div><div><div className="brand-name">Ekara Central</div><div className="brand-sub">Project Knowledge Hub</div></div></div>
      
      {nav.map(item => <button key={item.label} className={`nav-item ${section === item.label ? "active" : ""}`} onClick={() => { setSection(item.label); setQuery(""); setSelectedSolution(null); }}><item.icon /><span>{item.label}</span></button>)}
      <div className="nav-label" style={{ marginTop: 18 }}>TOOLS</div>
      <button className="nav-item" onClick={() => goSearch("website down")}><LifeBuoy/><span>Support & Recovery</span></button>
      <button className="nav-item" onClick={() => goSearch("deploy website update")}><Wrench/><span>Operations</span></button>
      <div className="sidebar-bottom"><button className="nav-item"><CircleHelp/><span>Help & feedback</span></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">Workspace <ChevronRight size={14} style={{ verticalAlign: "middle", margin: "0 6px" }}/><strong>{section}</strong></div><GlobalSearch onSelect={hit => { const target: Section = hit.kind === "Customer" || (hit.kind === "Contact" && !hit.projectName) ? "Customers" : hit.kind === "Knowledge" ? "Knowledge Base" : "Projects"; setSection(target); setFilter(hit.projectName || hit.customerName || hit.title); setQuery(""); setSelectedSolution(null); }} /><div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={17}/></button><button className="icon-button" aria-label="Activity"><Activity size={17}/></button><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ textAlign: "right", lineHeight: 1.25 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#344154" }}>{userEmail}</div><div style={{ fontSize: 11, color: "#8993a2", textTransform: "capitalize" }}>{userRole.replace("_", " ")}</div></div><button className="secondary-button" onClick={signOut}>Sign out</button></div></div></header>
      <main className="main">
        {section === "Dashboard" && <>
          <div className="welcome-row dashboard-heading"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Your customers, projects and operational knowledge — all in one place.</p></div><div className="dashboard-actions"><button className="primary-button" onClick={() => setSection("Customers")}><Plus size={17}/> New customer</button><button className="primary-button" onClick={() => setSection("Projects")}><Plus size={17}/> New project</button></div></div>
          <section className="search-panel"><div className="search-head"><div className="search-badge"><Sparkles size={19}/></div><div><div className="search-title">Ask Ekara — find answers and solutions</div><div className="search-desc">Search across projects, documents and troubleshooting knowledge.</div></div></div><div className="search-box"><Search size={19} color="#7d8ba0"/><input value={query} onChange={e => {setQuery(e.target.value);setSelectedSolution(null);}} placeholder="Describe what you need help with… e.g. website is down"/><span className="search-hint">Live suggestions</span></div>
            {query ? <div className="solution-list" style={{ marginTop: 13 }}>{matches.length ? matches.map(s => <button className="solution" key={s.title} onClick={() => setSelectedSolution(s)} style={{ textAlign: "left", background: "white", width: "100%" }}><div className="solution-icon"><Lightbulb size={17}/></div><div><div className="solution-title">{s.title}</div><div className="solution-meta">{s.description}</div><div className="solution-meta">{s.category} · {s.source}</div></div><ChevronRight size={16} color="#98a3b2" style={{ marginLeft: "auto", flexShrink: 0 }}/></button>) : <div className="empty-state">No matching recommendations yet. Try “website”, “deploy”, “database” or “access”.</div>}</div> : <div className="suggestions"><button className="suggestion" onClick={() => goSearch("website down")}><Globe size={15}/> Website is down</button><button className="suggestion" onClick={() => goSearch("deploy website update")}><Code2 size={15}/> Deploy an update</button><button className="suggestion" onClick={() => goSearch("access username password")}><ShieldCheck size={15}/> Find access details</button></div>}
            {selectedSolution && <div className="kb-card" style={{ marginTop: 14, borderColor: "#cbdaf7" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={17} color="#2b966b"/><h3>{selectedSolution.title}</h3></div><p>{selectedSolution.description}</p><div className="kb-meta"><span>{selectedSolution.category} · {selectedSolution.source}</span><button className="text-link" onClick={() => setSection("Knowledge Base")}>Open knowledge base <ArrowUpRight size={13} style={{ verticalAlign: "middle" }}/></button></div></div>}
          </section>
          <div className="stats-grid"><Stat icon={Building2} label="Customers" value="12" foot="Organisations managed" tint="#eaf1ff" ink="#356de6"/><Stat icon={FolderKanban} label="Active projects" value="18" foot={<><span className="positive">3 updated</span> this week</>} tint="#e8f7ef" ink="#269565"/><Stat icon={BookOpen} label="Knowledge articles" value="46" foot="Guides, runbooks & solutions" tint="#f2edff" ink="#8056c9"/><Stat icon={ShieldCheck} label="Needs review" value="4" foot="Knowledge items to refresh" tint="#fff3df" ink="#c28a2d"/></div>
          <div className="content-grid"><section className="panel"><div className="panel-header"><div><h2 className="panel-title">Recently accessed projects</h2><div className="panel-sub">Your active workspaces</div></div><button className="text-link" onClick={() => setSection("Projects")}>View all <ChevronRight size={13} style={{ verticalAlign: "middle" }}/></button></div>{projects.map(p => <div className="project-row" key={p.name}><div className="project-logo" style={{ background: p.color, color: p.ink }}>{p.initials}</div><div><div className="project-name">{p.name}</div><div className="project-customer">{p.customer} · {p.type}</div></div><span className={`status ${p.status === "Active" ? "active" : "review"}`}>{p.status}</span></div>)}</section>
          <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Knowledge activity</h2><div className="panel-sub">Recently updated information</div></div><button className="text-link" onClick={() => setSection("Knowledge Base")}>Browse <ChevronRight size={13} style={{ verticalAlign: "middle" }}/></button></div>{articles.slice(0,3).map((a,i) => <div className="activity" key={a.title}><div className="activity-dot" style={{ background: i===0 ? "#4d7ce5" : i===1 ? "#35a77a" : "#9b77dc" }}/><div><div className="activity-title">{a.title}</div><div className="activity-time">{a.updated}</div></div></div>)}</section></div>
        </>}
        {section === "Customers" && <><PageHeading eyebrow="Relationship management" title="Customers" subtitle="Keep customer contacts, context and linked projects together." action={<button className="primary-button"><Plus size={16}/> Add customer</button>}/><Toolbar value={filter} onChange={setFilter} placeholder="Search customers…"/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Projects</th><th>Status</th><th>Contact</th></tr></thead><tbody>{customers.filter(c => (c.name+c.contact).toLowerCase().includes(filter.toLowerCase())).map(c=><tr key={c.name}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="project-logo" style={{background:c.color,color:c.ink}}>{c.initials}</div><div className="table-primary">{c.name}</div></div></td><td>{c.projects}</td><td><span className={`status ${c.status === "Active" ? "active" : "review"}`}>{c.status}</span></td><td>{c.contact}</td></tr>)}</tbody></table></div></section></>}
        {section === "Projects" && <><PageHeading eyebrow="Delivery & operations" title="Projects" subtitle="Project records, technical details, infrastructure and documentation." action={<button className="primary-button"><Plus size={16}/> New project</button>}/><Toolbar value={filter} onChange={setFilter} placeholder="Search projects…"/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Project</th><th>Customer</th><th>Type</th><th>Status</th><th>Workspace</th></tr></thead><tbody>{projects.filter(p=>(p.name+p.customer+p.type).toLowerCase().includes(filter.toLowerCase())).map(p=><tr key={p.name}><td><div className="table-primary">{p.name}</div><div className="table-secondary">Technical handover & project records</div></td><td>{p.customer}</td><td>{p.type}</td><td><span className={`status ${p.status === "Active" ? "active" : "review"}`}>{p.status}</span></td><td><button className="text-link" onClick={()=>goSearch("access details "+p.name)}>Find details <ArrowUpRight size={13}/></button></td></tr>)}</tbody></table></div></section><div className="footer-note">Project records will include contacts, requirements, environments, servers, URLs, source repositories, components, licences, diagrams and guides.</div></>}
        {section === "Knowledge Base" && <><PageHeading eyebrow="Shared knowledge" title="Knowledge Base" subtitle="Search and discover solutions across your accessible project information." action={<button className="primary-button"><Plus size={16}/> New article</button>}/><div className="search-panel"><div className="search-box"><Search size={18} color="#7d8ba0"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search articles, errors, procedures and solutions…"/><span className="search-hint">Search</span></div><div className="search-desc" style={{marginTop:10}}>Recommendations update as you type. Select an article to explore it.</div></div><div className="kb-grid">{articles.filter(a=>(a.title+a.desc+a.type).toLowerCase().includes(filter.toLowerCase())).map(a=><article className="kb-card" key={a.title}><div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}><div className="solution-icon"><a.icon size={17}/></div><span className="status active">{a.type}</span></div><h3>{a.title}</h3><p>{a.desc}</p><div className="kb-meta"><span>{a.updated}</span><button className="text-link" onClick={()=>{setQuery(a.title);setSection("Dashboard");}}>Find related <ChevronRight size={13}/></button></div></article>)}</div></>}
        <div className="footer-note">Ekara Central · Customer and project knowledge, connected.</div>
      </main>
    </div>
  </div>;
}
function Stat({icon:Icon,label,value,foot,tint,ink}:{icon:typeof Gauge;label:string;value:string;foot:React.ReactNode;tint:string;ink:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon" style={{background:tint,color:ink}}><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>}
function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action:React.ReactNode}){return <div className="welcome-row"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>}
function Toolbar({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string}){return <div className="page-toolbar"><label className="search-small"><Search size={16} color="#8994a4"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label><button className="secondary-button"><FileText size={15}/> Export</button></div>}

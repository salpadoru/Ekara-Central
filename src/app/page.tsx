"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/global-search";
import { Activity, BookOpen, Building2, ChevronRight, CircleHelp, Code2, FileText, FolderKanban, Gauge, HardDrive, Menu, Plus, Search, Server, ShieldCheck, X } from "lucide-react";

type Section = "Dashboard" | "Customers" | "Projects" | "Knowledge Base";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectCounts, setProjectCounts] = useState({ total: 0, active: 0, priority: 0, customers: 0 });
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
      const [{ data: projectRows }, { count: customerCount }] = await Promise.all([
        supabase.from("projects").select("id,name,status,priority,customers(name),updated_at").order("updated_at", { ascending: false }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      setRecentProjects((projectRows ?? []).slice(0,5).map((p: any) => ({ id:p.id, name:p.name, status:p.status, priority:p.priority ?? "normal", customerName: Array.isArray(p.customers) ? p.customers[0]?.name ?? "" : p.customers?.name ?? "" })));
      setProjectCounts({ total: projectRows?.length ?? 0, active: projectRows?.filter((p: any) => p.status === "active").length ?? 0, priority: projectRows?.filter((p: any) => ["critical","high"].includes(p.priority)).length ?? 0, customers: customerCount ?? 0 });
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
  const [filter, setFilter] = useState("");
  const [recentProjects, setRecentProjects] = useState<{id:string;name:string;status:string;priority:string;customerName:string}[]>([]);
  const nav = [{ label: "Dashboard" as Section, icon: Gauge }, { label: "Customers" as Section, icon: Building2 }, { label: "Projects" as Section, icon: FolderKanban }, { label: "Knowledge Base" as Section, icon: BookOpen }];
  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
  };
  if (!authReady) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#647184" }}>Loading your Ekara workspace…</div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">E</div><div><div className="brand-name">Ekara Central</div><div className="brand-sub">Project Knowledge Hub</div></div></div>
      <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Toggle menu">{mobileMenuOpen ? <X size={21}/> : <Menu size={21}/>}<span>Menu</span></button>
      <nav className={`primary-nav ${mobileMenuOpen ? "open" : ""}`}>{nav.map(item => <button key={item.label} className={`nav-item ${section === item.label ? "active" : ""}`} onClick={() => { setSection(item.label); setMobileMenuOpen(false); }}><item.icon /><span>{item.label}</span></button>)}</nav>

    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb">Workspace <ChevronRight size={14} style={{ verticalAlign: "middle", margin: "0 6px" }}/><strong>{section}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={17}/></button><button className="icon-button" aria-label="Activity"><Activity size={17}/></button><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ textAlign: "right", lineHeight: 1.25 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#344154" }}>{userEmail}</div><div style={{ fontSize: 11, color: "#8993a2", textTransform: "capitalize" }}>{userRole.replace("_", " ")}</div></div><button className="secondary-button" onClick={signOut}>Sign out</button></div></div></header>
      <main className="main">
        <div className="main-search"><GlobalSearch onSelect={hit => { const target: Section = hit.kind === "Customer" || (hit.kind === "Contact" && !hit.projectName) ? "Customers" : hit.kind === "Knowledge" ? "Knowledge Base" : "Projects"; setSection(target); setFilter(hit.projectName || hit.customerName || hit.title); }} /></div>
        {section === "Dashboard" && <>
          <div className="welcome-row dashboard-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1 className="page-title">Welcome back</h1><p className="page-subtitle">Here’s what’s happening across your projects.</p></div><div className="dashboard-actions"><button className="primary-button" onClick={() => setSection("Customers")}><Plus size={17}/> New customer</button><button className="primary-button" onClick={() => setSection("Projects")}><Plus size={17}/> New project</button></div></div>
          <div className="dashboard-section-label">WORKSPACE PULSE</div>
          <div className="stats-grid dashboard-stats">
            <div className="stat-card"><div className="stat-top"><span>Customers</span><span className="stat-icon stat-blue"><Building2 size={19}/></span></div><div className="stat-value">{projectCounts.customers}</div></div>
            <div className="stat-card"><div className="stat-top"><span>Projects</span><span className="stat-icon stat-purple"><FolderKanban size={19}/></span></div><div className="stat-value">{projectCounts.total}</div></div>
            <div className="stat-card"><div className="stat-top"><span>Active</span><span className="stat-icon stat-green"><Activity size={19}/></span></div><div className="stat-value">{projectCounts.active}</div></div>
            <div className="stat-card"><div className="stat-top"><span>Priority</span><span className="stat-icon stat-amber"><ShieldCheck size={19}/></span></div><div className="stat-value">{projectCounts.priority}</div></div>
          </div>
          <div className="dashboard-section-label">RECENT PROJECTS</div>
          <section className="panel dashboard-projects">
            {recentProjects.length ? recentProjects.map(p => <button className="project-row project-row-button" key={p.id} onClick={() => { setSection("Projects"); setFilter(p.name); }}><div className="project-logo">{p.name.slice(0,2).toUpperCase()}</div><div className="project-row-copy"><div className="project-name">{p.name}</div><div className="project-customer">{p.customerName}</div></div><span className={`status ${p.status === "active" ? "active" : "review"}`}>{p.status.replace("_"," ")}</span><ChevronRight size={16} className="project-chevron"/></button>) : <div className="dashboard-empty"><FolderKanban size={25}/><div>No projects yet</div><button className="text-link" onClick={() => setSection("Projects")}>Create your first project</button></div>}
          </section>
        </>}
        {section === "Customers" && <><PageHeading eyebrow="Relationship management" title="Customers" subtitle="Keep customer contacts, context and linked projects together." action={<button className="primary-button"><Plus size={16}/> Add customer</button>}/><Toolbar value={filter} onChange={setFilter} placeholder="Search customers…"/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Projects</th><th>Status</th><th>Contact</th></tr></thead><tbody>{customers.filter(c => (c.name+c.contact).toLowerCase().includes(filter.toLowerCase())).map(c=><tr key={c.name}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="project-logo" style={{background:c.color,color:c.ink}}>{c.initials}</div><div className="table-primary">{c.name}</div></div></td><td>{c.projects}</td><td><span className={`status ${c.status === "Active" ? "active" : "review"}`}>{c.status}</span></td><td>{c.contact}</td></tr>)}</tbody></table></div></section></>}
        {section === "Projects" && <><PageHeading eyebrow="Delivery & operations" title="Projects" subtitle="Project records, technical details, infrastructure and documentation." action={<button className="primary-button"><Plus size={16}/> New project</button>}/><Toolbar value={filter} onChange={setFilter} placeholder="Search projects…"/><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Project</th><th>Customer</th><th>Type</th><th>Status</th><th>Workspace</th></tr></thead><tbody>{projects.filter(p=>(p.name+p.customer+p.type).toLowerCase().includes(filter.toLowerCase())).map(p=><tr key={p.name}><td><div className="table-primary">{p.name}</div><div className="table-secondary">Technical handover & project records</div></td><td>{p.customer}</td><td>{p.type}</td><td><span className={`status ${p.status === "Active" ? "active" : "review"}`}>{p.status}</span></td><td></td></tr>)}</tbody></table></div></section><div className="footer-note">Project records will include contacts, requirements, environments, servers, URLs, source repositories, components, licences, diagrams and guides.</div></>}
        {section === "Knowledge Base" && <><PageHeading eyebrow="Shared knowledge" title="Knowledge Base" subtitle="Search and discover solutions across your accessible project information." action={<button className="primary-button"><Plus size={16}/> New article</button>}/><div className="search-panel"><div className="search-box"><Search size={18} color="#7d8ba0"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search articles, errors, procedures and solutions…"/><span className="search-hint">Search</span></div><div className="search-desc" style={{marginTop:10}}>Recommendations update as you type. Select an article to explore it.</div></div><div className="kb-grid">{articles.filter(a=>(a.title+a.desc+a.type).toLowerCase().includes(filter.toLowerCase())).map(a=><article className="kb-card" key={a.title}><div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}><div className="solution-icon"><a.icon size={17}/></div><span className="status active">{a.type}</span></div><h3>{a.title}</h3><p>{a.desc}</p><div className="kb-meta"><span>{a.updated}</span><button className="text-link" onClick={()=>{setSection("Dashboard");}}>Find related <ChevronRight size={13}/></button></div></article>)}</div></>}
        <div className="footer-note">Ekara Central · Customer and project knowledge, connected.</div>
      </main>
    </div>
  </div>;
}
function Stat({icon:Icon,label,value,foot,tint,ink}:{icon:typeof Gauge;label:string;value:string;foot:React.ReactNode;tint:string;ink:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon" style={{background:tint,color:ink}}><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>}
function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action:React.ReactNode}){return <div className="welcome-row"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>}
function Toolbar({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string}){return <div className="page-toolbar"><label className="search-small"><Search size={16} color="#8994a4"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label><button className="secondary-button"><FileText size={15}/> Export</button></div>}

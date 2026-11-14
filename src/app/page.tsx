"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/global-search";
import RelationshipWorkspace from "@/components/relationship-workspace";
import { Activity, Building2, Boxes, ChevronRight, CircleHelp, FolderKanban, Menu, X } from "lucide-react";

type Section = "Customers" | "Projects" | "Components";
export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [section, setSection] = useState<Section>("Customers");
  const [filter, setFilter] = useState("");
  const nav = [{ label: "Customers" as Section, icon: Building2 }, { label: "Projects" as Section, icon: FolderKanban }, { label: "Components" as Section, icon: Boxes }];
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
        <div className="main-search"><GlobalSearch onSelect={hit => { const target: Section = hit.kind === "Customer" || (hit.kind === "Contact" && !hit.projectName) ? "Customers" : "Projects"; setSection(target); setFilter(hit.projectName || hit.customerName || hit.title); }} /></div>
        <RelationshipWorkspace section={section} filter={filter} onNavigate={(next,id) => { setSection(next); setFilter(""); window.setTimeout(() => window.dispatchEvent(new CustomEvent("ekara-select-record",{detail:{kind:next,id}})),0); }} />
        <div className="footer-note">Ekara Central · Customer and project knowledge, connected.</div>
      </main>
    </div>
  </div>;
}
function Stat({icon:Icon,label,value,foot,tint,ink}:{icon:typeof Gauge;label:string;value:string;foot:React.ReactNode;tint:string;ink:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon" style={{background:tint,color:ink}}><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>}
function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action:React.ReactNode}){return <div className="welcome-row"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>}
function Toolbar({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string}){return <div className="page-toolbar"><label className="search-small"><Search size={16} color="#8994a4"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label><button className="secondary-button"><FileText size={15}/> Export</button></div>}

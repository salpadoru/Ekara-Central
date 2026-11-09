"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BookOpen, Building2, FileText, FolderKanban, Search, Users, Wrench } from "lucide-react";

type SearchKind = "Customer" | "Project" | "Contact" | "Document" | "Component" | "Knowledge";
type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  detail: string;
  customerName?: string;
  projectName?: string;
};

const icons = {
  Customer: Building2,
  Project: FolderKanban,
  Contact: Users,
  Document: FileText,
  Component: Wrench,
  Knowledge: BookOpen,
};

export default function GlobalSearch({ onSelect }: { onSelect: (hit: SearchHit) => void }) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", handleKeys);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleKeys);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, []);

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) {
      setHits([]);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      setLoading(true);
      setError("");
      const pattern = `%${value.replace(/[,%()]/g, " ")}%`;
      try {
        // Every query runs through Supabase RLS; inaccessible project records are not returned.
        const [customers, projects, projectContacts, customerContacts, documents, components, knowledge] = await Promise.all([
          supabase.from("customers").select("id,name").ilike("name", pattern).limit(6),
          supabase.from("projects").select("id,name,customer_id").ilike("name", pattern).limit(6),
          supabase.from("project_contacts").select("id,full_name,role_title,project_id,email").or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(6),
          supabase.from("customer_contacts").select("id,full_name,role_title,customer_id,email").or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(6),
          supabase.from("project_documents").select("id,title,description,project_id").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(6),
          supabase.from("project_components").select("id,name,vendor,component_type,project_id").or(`name.ilike.${pattern},vendor.ilike.${pattern},component_type.ilike.${pattern}`).limit(6),
          supabase.from("knowledge_articles").select("id,title,summary,kind,project_id,customer_id").or(`title.ilike.${pattern},summary.ilike.${pattern}`).limit(6),
        ]);
        const failed = [customers, projects, projectContacts, customerContacts, documents, components, knowledge].find(result => result.error);
        if (failed?.error) throw failed.error;
        const rows = [ ...(projects.data ?? []), ...(projectContacts.data ?? []).map(x => ({ customer_id: null, id: x.project_id })), ...(documents.data ?? []).map(x => ({ customer_id: null, id: x.project_id })), ...(components.data ?? []).map(x => ({ customer_id: null, id: x.project_id })), ...(knowledge.data ?? []).filter(x => x.project_id).map(x => ({ customer_id: x.customer_id, id: x.project_id })) ];
        const projectIds = [...new Set(rows.map(x => x.id).filter(Boolean))];
        const customerIds = [...new Set([...(customers.data ?? []).map(x => x.id), ...(customerContacts.data ?? []).map(x => x.customer_id), ...rows.map(x => x.customer_id)].filter(Boolean))];
        const [projectLookup, customerLookup] = await Promise.all([
          projectIds.length ? supabase.from("projects").select("id,name,customer_id").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
          customerIds.length ? supabase.from("customers").select("id,name").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (projectLookup.error) throw projectLookup.error;
        if (customerLookup.error) throw customerLookup.error;
        const projectMap = new Map((projectLookup.data ?? []).map(x => [x.id, x]));
        const customerMap = new Map((customerLookup.data ?? []).map(x => [x.id, x.name]));
        const hierarchy = (projectId?: string | null, customerId?: string | null) => {
          const project = projectId ? projectMap.get(projectId) : null;
          return { projectName: project?.name, customerName: customerMap.get(customerId ?? project?.customer_id ?? "") };
        };
        const result: SearchHit[] = [
          ...(customers.data ?? []).map(x => ({ id: x.id, kind: "Customer" as const, title: x.name, detail: "Customer record", customerName: x.name })),
          ...(projects.data ?? []).map(x => ({ id: x.id, kind: "Project" as const, title: x.name, detail: "Project workspace", ...hierarchy(x.id, x.customer_id) })),
          ...(projectContacts.data ?? []).map(x => ({ id: x.id, kind: "Contact" as const, title: x.full_name, detail: x.role_title || x.email || "Project contact", ...hierarchy(x.project_id) })),
          ...(customerContacts.data ?? []).map(x => ({ id: x.id, kind: "Contact" as const, title: x.full_name, detail: x.role_title || x.email || "Customer contact", ...hierarchy(null, x.customer_id) })),
          ...(documents.data ?? []).map(x => ({ id: x.id, kind: "Document" as const, title: x.title, detail: x.description || "Project document", ...hierarchy(x.project_id) })),
          ...(components.data ?? []).map(x => ({ id: x.id, kind: "Component" as const, title: x.name, detail: [x.vendor, x.component_type].filter(Boolean).join(" · ") || "Project component", ...hierarchy(x.project_id) })),
          ...(knowledge.data ?? []).map(x => ({ id: x.id, kind: "Knowledge" as const, title: x.title, detail: x.summary || x.kind, ...hierarchy(x.project_id, x.customer_id) })),
        ];
        if (!cancelled) setHits(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search could not be completed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term]);

  const grouped = (["Customer", "Project", "Contact", "Document", "Component", "Knowledge"] as SearchKind[])
    .map(kind => ({ kind, items: hits.filter(hit => hit.kind === kind) }))
    .filter(group => group.items.length > 0);

  return <div className="global-search" ref={rootRef}>
    <div className="global-search-input">
      <Search size={18} />
      <input ref={inputRef} value={term} onFocus={() => setOpen(true)} onChange={event => { setTerm(event.target.value); setOpen(true); }} placeholder="Search customers, projects, documents…" aria-label="Search all Ekara records" />
      <kbd>⌘ K</kbd>
    </div>
    {open && term.trim().length >= 2 && <div className="global-search-results">
      {loading && <div className="global-search-message">Searching your accessible records…</div>}
      {error && <div className="global-search-message search-error">{error}</div>}
      {!loading && !error && grouped.length === 0 && <div className="global-search-message">No matching records found.</div>}
      {grouped.map(group => <section className="global-search-group" key={group.kind}>
        <div className="global-search-label">{group.kind}s</div>
        {group.items.map(hit => {
          const Icon = icons[hit.kind];
          return <button key={`${hit.kind}-${hit.id}`} className="global-search-hit" onClick={() => { onSelect(hit); setOpen(false); setTerm(""); }}>
            <span className="global-search-icon"><Icon size={17} /></span>
            <span className="global-search-copy"><strong>{hit.title}</strong><small>{[hit.customerName, hit.projectName, hit.detail].filter(Boolean).join(" · ")}</small></span>
          </button>;
        })}
      </section>)}
      <div className="global-search-foot">Results are limited to information you have permission to access.</div>
    </div>}
  </div>;
}

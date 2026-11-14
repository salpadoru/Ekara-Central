"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, ExternalLink } from "lucide-react";

type Task = {
  id: string; project_id: string; title: string; description: string | null;
  task_type: string; priority: string; status: string; due_date: string | null;
  source_type: string | null; source_id: string | null; source_label: string | null;
  projectName: string; customerName: string;
};
type Technical = {
  project_id: string; ssl_provider: string | null; ssl_installation_location: string | null;
  ssl_management_url: string | null; ssl_certificate_type: string | null;
  ssl_expiry_date: string | null; ssl_renewal_method: string | null;
  ssl_responsible_contact: string | null; domain_registrar: string | null;
  dns_provider: string | null; domain_expiry_date: string | null;
};
type Access = { project_id: string; system_name: string; login_url: string | null; username_or_account: string | null; vault_item_reference: string | null; access_process: string | null; owner_contact: string | null };

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value: string | null) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";

export default function TaskCards() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [technical, setTechnical] = useState<Record<string, Technical>>({});
  const [access, setAccess] = useState<Record<string, Access[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true); setError("");
    const { data, error: taskError } = await supabase.from("project_tasks")
      .select("id,project_id,title,description,task_type,priority,status,due_date,source_type,source_id,source_label,projects(name,customers(name))")
      .in("status", ["open", "in_progress", "waiting"])
      .order("due_date", { ascending: true, nullsFirst: false }).limit(30);
    if (taskError) { setError(taskError.message); setLoading(false); return; }
    const rows = (data ?? []).map((t: any) => ({
      id:t.id, project_id:t.project_id, title:t.title, description:t.description,
      task_type:t.task_type, priority:t.priority, status:t.status, due_date:t.due_date,
      source_type:t.source_type, source_id:t.source_id, source_label:t.source_label,
      projectName:Array.isArray(t.projects) ? t.projects[0]?.name ?? "" : t.projects?.name ?? "",
      customerName:Array.isArray(t.projects?.customers) ? t.projects.customers[0]?.name ?? "" : t.projects?.customers?.name ?? "",
    })) as Task[];
    setTasks(rows);
    const ids = [...new Set(rows.map(t => t.project_id))];
    if (ids.length) {
      const [profileResult, accessResult] = await Promise.all([
        supabase.from("project_technical_profiles").select("project_id,ssl_provider,ssl_installation_location,ssl_management_url,ssl_certificate_type,ssl_expiry_date,ssl_renewal_method,ssl_responsible_contact,domain_registrar,dns_provider,domain_expiry_date").in("project_id", ids),
        supabase.from("project_access_references").select("project_id,system_name,login_url,username_or_account,vault_item_reference,access_process,owner_contact").in("project_id", ids),
      ]);
      if (profileResult.error) setError(profileResult.error.message);
      setTechnical(Object.fromEntries((profileResult.data ?? []).map((p: any) => [p.project_id, p])));
      setAccess((accessResult.data ?? []).reduce((acc: Record<string, Access[]>, item: Access) => {
        (acc[item.project_id] ??= []).push(item); return acc;
      }, {}));
    } else { setTechnical({}); setAccess({}); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (task: Task, status: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(task.id);
    const { error: updateError } = await supabase.from("project_tasks").update({
      status, completed_at: status === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq("id", task.id);
    if (updateError) setError(updateError.message);
    else {
      if (task.source_type === "attention_item" && task.source_id) {
        const attentionStatus = status === "completed" ? "resolved" : status === "in_progress" ? "acknowledged" : "open";
        await supabase.from("project_attention_items").update({
          status: attentionStatus, resolved_at: attentionStatus === "resolved" ? new Date().toISOString() : null
        }).eq("id", task.source_id);
      }
      await load();
    }
    setSaving(null);
  };

  return <section style={{ marginTop: 28 }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <div><div className="dashboard-section-label" style={{margin:0}}>ACTION REQUIRED</div><div style={{fontSize:21,fontWeight:700,color:"#263449",marginTop:5}}>Task cards</div></div>
      <button className="secondary-button" onClick={() => void load()}>Refresh</button>
    </div>
    {loading ? <div className="panel" style={{padding:22,color:"#647184"}}>Loading tasks…</div> :
      error ? <div className="panel" style={{padding:18,color:"#a33"}}>{error}</div> :
      tasks.length === 0 ? <div className="panel" style={{padding:22,color:"#647184"}}><ClipboardList size={20}/> No outstanding tasks.</div> :
      <div style={{display:"grid",gap:12}}>
        {tasks.map(task => {
          const open = expanded === task.id, info = technical[task.project_id], accesses = access[task.project_id] ?? [];
          const isSsl = task.title.toLowerCase().includes("ssl") || task.title.toLowerCase().includes("certificate");
          const isDomain = task.title.toLowerCase().includes("domain");
          return <article key={task.id} className="panel" style={{padding:18}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:38,height:38,borderRadius:11,background:task.priority === "critical" || task.priority === "high" ? "#fff0e8" : "#edf3ff",color:task.priority === "critical" || task.priority === "high" ? "#c36a36" : "#416bc1",display:"grid",placeItems:"center",flexShrink:0}}><AlertTriangle size={19}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><strong style={{fontSize:17,color:"#263449"}}>{task.title}</strong><span className={`status ${task.priority === "critical" || task.priority === "high" ? "review" : "active"}`}>{label(task.priority)}</span></div>
                <div style={{fontSize:14,color:"#68768a",marginTop:5}}>{task.customerName} · {task.projectName}</div>
                {task.description && <p style={{fontSize:15,color:"#475569",margin:"10px 0 0"}}>{task.description}</p>}
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:12}}>
                  <span style={{fontSize:13,color:"#65748a"}}>Due: {dateLabel(task.due_date)}</span>
                  <span style={{fontSize:13,color:"#65748a"}}>{label(task.task_type)}</span>
                  <button className="text-link" onClick={() => setExpanded(open ? null : task.id)}>{open ? "Hide details" : "View task details"} {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
                </div>
              </div>
              <select aria-label="Task status" value={task.status} disabled={saving === task.id} onChange={e => void updateStatus(task,e.target.value)} style={{fontSize:14,padding:"8px 10px",border:"1px solid #dce3ec",borderRadius:9,background:"#fff",color:"#344154",maxWidth:145}}>
                <option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="completed">Completed</option>
              </select>
            </div>
            {open && <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e9edf2",display:"grid",gap:14}}>
              <div><div style={{fontSize:13,fontWeight:700,color:"#344154",marginBottom:8}}>PROJECT CONTEXT</div><div style={{fontSize:14,color:"#566579"}}>Source: {task.source_label ?? label(task.source_type ?? "manual")}</div></div>
              {isSsl && <div><div style={{fontSize:13,fontWeight:700,color:"#344154",marginBottom:8}}>SSL CERTIFICATE</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
                  {([["Provider",info?.ssl_provider],["Installed at",info?.ssl_installation_location],["Management URL",info?.ssl_management_url],["Certificate type",info?.ssl_certificate_type],["Expiry date",dateLabel(info?.ssl_expiry_date ?? null)],["Renewal method",info?.ssl_renewal_method],["Responsible contact",info?.ssl_responsible_contact]] as [string,string|null|undefined][]).map(([k,v])=><div key={k}><div style={{fontSize:12,color:"#8190a3"}}>{k}</div><div style={{fontSize:14,color:v ? "#344154" : "#b45335",fontWeight:600,overflowWrap:"anywhere"}}>{v || "Information missing"}</div></div>)}
                </div>
                {!info?.ssl_installation_location && <div style={{marginTop:10,fontSize:13,color:"#a45332"}}>SSL installation location has not been recorded. Request the missing infrastructure details from the project developer.</div>}
              </div>}
              {isDomain && <div><div style={{fontSize:13,fontWeight:700,color:"#344154",marginBottom:8}}>DOMAIN & DNS</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{([["Registrar",info?.domain_registrar],["DNS provider",info?.dns_provider],["Expiry date",dateLabel(info?.domain_expiry_date ?? null)]] as [string,string|null|undefined][]).map(([k,v])=><div key={k}><div style={{fontSize:12,color:"#8190a3"}}>{k}</div><div style={{fontSize:14,color:v ? "#344154" : "#b45335",fontWeight:600}}>{v || "Information missing"}</div></div>)}</div></div>}
              {accesses.length > 0 && <div><div style={{fontSize:13,fontWeight:700,color:"#344154",marginBottom:8}}>RELATED ACCESS REFERENCES</div>{accesses.map((a,i)=><div key={i} style={{padding:"10px 0",borderTop:"1px solid #edf0f4",display:"grid",gap:4}}><strong style={{fontSize:14}}>{a.system_name}</strong><span style={{fontSize:13,color:"#65748a"}}>{a.username_or_account || "Account not recorded"} · {a.owner_contact || "Owner not recorded"}</span>{a.login_url && <a href={a.login_url} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#3565c8"}}>Open login <ExternalLink size={12} style={{verticalAlign:"middle"}}/></a>}<span style={{fontSize:13,color:a.vault_item_reference ? "#65748a" : "#b45335"}}>Vault reference: {a.vault_item_reference || "Information missing"}</span>{a.access_process && <span style={{fontSize:13,color:"#65748a"}}>{a.access_process}</span>}</div>)}</div>}
              <div style={{fontSize:12,color:"#8190a3"}}>Passwords and API keys are not displayed or stored in Ekara Central.</div>
            </div>}
          </article>;
        })}
      </div>}
  </section>;
}

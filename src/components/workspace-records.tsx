"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

type Customer = { id:string; name:string; website_url:string|null; phone:string|null; email:string|null; address:string|null; status:string };
type Project = { id:string; name:string; project_code:string|null; project_type:string|null; status:string; priority:string; customer_id:string; customers?:{name:string}|{name:string}[]|null };
type Props = { section:"Customers"|"Projects"; filter:string };

const field: React.CSSProperties = { width:"100%",padding:"11px 12px",border:"1px solid #d9e1eb",borderRadius:9,fontSize:15,color:"#263449",background:"#fff" };
const labelStyle: React.CSSProperties = { display:"grid",gap:6,fontSize:14,fontWeight:600,color:"#45546a" };

export default function WorkspaceRecords({section,filter}:Props) {
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [customerForm,setCustomerForm]=useState({name:"",website_url:"",phone:"",email:"",address:"",notes:"",contact_name:"",contact_role:"",contact_email:"",contact_phone:""});
  const [projectForm,setProjectForm]=useState({customer_id:"",name:"",project_code:"",project_type:"",status:"planning",priority:"normal",start_date:"",target_date:"",summary:"",requirements:""});

  const load=useCallback(async()=>{
    const db=getSupabaseBrowserClient(); if(!db)return;
    setLoading(true);setError("");
    const [c,p]=await Promise.all([
      db.from("customers").select("id,name,website_url,phone,email,address,status").order("name"),
      db.from("projects").select("id,name,project_code,project_type,status,priority,customer_id,customers(name)").order("updated_at",{ascending:false})
    ]);
    if(c.error)setError(c.error.message);else setCustomers(c.data??[]);
    if(p.error)setError(p.error.message);else setProjects((p.data??[]) as unknown as Project[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const save=async(e:React.FormEvent)=>{
    e.preventDefault();const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError("");setSuccess("");
    if(section==="Customers"){
      const {data:userData}=await db.auth.getUser();
      const {data:customer,error:customerError}=await db.from("customers").insert({
        name:customerForm.name.trim(),website_url:customerForm.website_url||null,phone:customerForm.phone||null,
        email:customerForm.email||null,address:customerForm.address||null,notes:customerForm.notes||null,
        created_by:userData.user?.id
      }).select("id").single();
      if(customerError){setError(customerError.message);setSaving(false);return;}
      if(customerForm.contact_name.trim()){
        const {error:contactError}=await db.from("customer_contacts").insert({
          customer_id:customer.id,full_name:customerForm.contact_name.trim(),
          role_title:customerForm.contact_role||null,email:customerForm.contact_email||null,
          phone:customerForm.contact_phone||null,is_primary:true
        });
        if(contactError){setError("Customer saved, but primary contact could not be saved: "+contactError.message);setSaving(false);await load();return;}
      }
      setCustomerForm({name:"",website_url:"",phone:"",email:"",address:"",notes:"",contact_name:"",contact_role:"",contact_email:"",contact_phone:""});
      setSuccess("Customer created.");
    }else{
      const {data:userData}=await db.auth.getUser();
      const {error:projectError}=await db.from("projects").insert({
        customer_id:projectForm.customer_id,name:projectForm.name.trim(),project_code:projectForm.project_code||null,
        project_type:projectForm.project_type||null,status:projectForm.status,priority:projectForm.priority,
        start_date:projectForm.start_date||null,target_date:projectForm.target_date||null,
        summary:projectForm.summary||null,requirements:projectForm.requirements||null,created_by:userData.user?.id
      });
      if(projectError){setError(projectError.message);setSaving(false);return;}
      setProjectForm({customer_id:"",name:"",project_code:"",project_type:"",status:"planning",priority:"normal",start_date:"",target_date:"",summary:"",requirements:""});
      setSuccess("Project created.");
    }
    setShowForm(false);setSaving(false);await load();
  };

  const filteredCustomers=customers.filter(c=>(c.name+" "+(c.email??"")+" "+(c.phone??"")).toLowerCase().includes(filter.toLowerCase()));
  const filteredProjects=projects.filter(p=>(p.name+" "+(p.project_code??"")+" "+(p.project_type??"")+" "+(Array.isArray(p.customers)?p.customers[0]?.name:p.customers?.name??"")).toLowerCase().includes(filter.toLowerCase()));
  const heading=section==="Customers"?"Customers":"Projects";
  return <div>
    <div className="welcome-row"><div><div className="eyebrow">{section==="Customers"?"RELATIONSHIP MANAGEMENT":"DELIVERY & OPERATIONS"}</div><h1 className="page-title">{heading}</h1><p className="page-subtitle">{section==="Customers"?"Customer details and primary contacts.":"Project records and delivery information."}</p></div>
      <button className="primary-button" onClick={()=>{setError("");setSuccess("");setShowForm(true);}}><Plus size={16}/>{section==="Customers"?"Add customer":"New project"}</button>
    </div>
    {success&&<div className="panel" style={{padding:12,marginTop:14,color:"#24734e"}}>{success}</div>}
    {error&&!showForm&&<div className="panel" style={{padding:12,marginTop:14,color:"#a33"}}>{error}</div>}
    {loading?<div className="panel" style={{padding:22,marginTop:18,color:"#647184"}}>Loading {heading.toLowerCase()}…</div>:
      section==="Customers"?<section className="panel" style={{marginTop:18}}><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead><tbody>{filteredCustomers.map(c=><tr key={c.id}><td><div className="table-primary">{c.name}</div><div className="table-secondary">{c.website_url??""}</div></td><td>{c.email??"—"}</td><td>{c.phone??"—"}</td><td><span className="status active">{c.status}</span></td></tr>)}</tbody></table>{filteredCustomers.length===0&&<div style={{padding:22,color:"#647184"}}>No customers found.</div>}</div></section>:
      <section className="panel" style={{marginTop:18}}><div className="table-wrap"><table className="data-table"><thead><tr><th>Project</th><th>Customer</th><th>Type</th><th>Status</th><th>Priority</th></tr></thead><tbody>{filteredProjects.map(p=><tr key={p.id}><td><div className="table-primary">{p.name}</div><div className="table-secondary">{p.project_code??""}</div></td><td>{Array.isArray(p.customers)?p.customers[0]?.name??"—":p.customers?.name??"—"}</td><td>{p.project_type??"—"}</td><td><span className="status active">{p.status.replaceAll("_"," ")}</span></td><td>{p.priority}</td></tr>)}</tbody></table>{filteredProjects.length===0&&<div style={{padding:22,color:"#647184"}}>No projects found.</div>}</div></section>}
    {showForm&&<div role="dialog" aria-modal="true" aria-label={section==="Customers"?"Add customer":"New project"} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(17,29,47,.48)",display:"grid",placeItems:"center",padding:16}}>
      <form onSubmit={save} className="panel" style={{width:"min(720px,100%)",maxHeight:"90vh",overflowY:"auto",padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:"#263449",margin:0}}>{section==="Customers"?"New customer":"New project"}</h2><button type="button" className="icon-button" onClick={()=>setShowForm(false)} aria-label="Close"><X size={20}/></button></div>
        {section==="Customers"?<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
            <label style={labelStyle}>Customer Name *<input required autoFocus style={field} value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})}/></label>
            <label style={labelStyle}>Website<input type="url" style={field} value={customerForm.website_url} onChange={e=>setCustomerForm({...customerForm,website_url:e.target.value})}/></label>
            <label style={labelStyle}>Phone<input style={field} value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/></label>
            <label style={labelStyle}>Email<input type="email" style={field} value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})}/></label>
            <label style={{...labelStyle,gridColumn:"1/-1"}}>Address<input style={field} value={customerForm.address} onChange={e=>setCustomerForm({...customerForm,address:e.target.value})}/></label>
          </div>
          <div style={{fontSize:15,fontWeight:700,color:"#344154",margin:"22px 0 12px"}}>Primary contact</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
            <label style={labelStyle}>Full Name<input style={field} value={customerForm.contact_name} onChange={e=>setCustomerForm({...customerForm,contact_name:e.target.value})}/></label>
            <label style={labelStyle}>Job Title<input style={field} value={customerForm.contact_role} onChange={e=>setCustomerForm({...customerForm,contact_role:e.target.value})}/></label>
            <label style={labelStyle}>Contact Email<input type="email" style={field} value={customerForm.contact_email} onChange={e=>setCustomerForm({...customerForm,contact_email:e.target.value})}/></label>
            <label style={labelStyle}>Contact Phone<input style={field} value={customerForm.contact_phone} onChange={e=>setCustomerForm({...customerForm,contact_phone:e.target.value})}/></label>
          </div>
          <label style={{...labelStyle,marginTop:14}}>Notes<textarea rows={3} style={field} value={customerForm.notes} onChange={e=>setCustomerForm({...customerForm,notes:e.target.value})}/></label>
        </>:<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
            <label style={labelStyle}>Customer *<select required style={field} value={projectForm.customer_id} onChange={e=>setProjectForm({...projectForm,customer_id:e.target.value})}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label style={labelStyle}>Project Name *<input required autoFocus style={field} value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/></label>
            <label style={labelStyle}>Project Code<input style={field} value={projectForm.project_code} onChange={e=>setProjectForm({...projectForm,project_code:e.target.value})}/></label>
            <label style={labelStyle}>Project Type<input style={field} value={projectForm.project_type} onChange={e=>setProjectForm({...projectForm,project_type:e.target.value})}/></label>
            <label style={labelStyle}>Status<select style={field} value={projectForm.status} onChange={e=>setProjectForm({...projectForm,status:e.target.value})}><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="support">Support</option><option value="archived">Archived</option></select></label>
            <label style={labelStyle}>Priority<select style={field} value={projectForm.priority} onChange={e=>setProjectForm({...projectForm,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label style={labelStyle}>Start Date<input type="date" style={field} value={projectForm.start_date} onChange={e=>setProjectForm({...projectForm,start_date:e.target.value})}/></label>
            <label style={labelStyle}>Target Date<input type="date" style={field} value={projectForm.target_date} onChange={e=>setProjectForm({...projectForm,target_date:e.target.value})}/></label>
          </div>
          <label style={{...labelStyle,marginTop:14}}>Project Description<textarea rows={3} style={field} value={projectForm.summary} onChange={e=>setProjectForm({...projectForm,summary:e.target.value})}/></label>
          <label style={{...labelStyle,marginTop:14}}>Requirements<textarea rows={3} style={field} value={projectForm.requirements} onChange={e=>setProjectForm({...projectForm,requirements:e.target.value})}/></label>
        </>}
        {error&&<div style={{marginTop:14,color:"#b33",fontSize:14}}>{error}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving?"Saving…":section==="Customers"?"Save customer":"Save project"}</button></div>
      </form>
    </div>}
  </div>;
}

-- Ekara Central: automatic identifiers and reusable relationship-aware components
-- Apply after 202611090004_project_tasks_and_technical_profile.sql.

create sequence if not exists public.customer_code_seq;
create sequence if not exists public.project_code_seq;

do $$
declare n bigint;
begin
  select coalesce(max(nullif(regexp_replace(customer_code, '\\D', '', 'g'), '')::bigint),0)
    into n from public.customers;
  if n = 0 then perform setval('public.customer_code_seq',1,false);
  else perform setval('public.customer_code_seq',n,true); end if;

  select coalesce(max(nullif(regexp_replace(project_code, '\\D', '', 'g'), '')::bigint),0)
    into n from public.projects;
  if n = 0 then perform setval('public.project_code_seq',1,false);
  else perform setval('public.project_code_seq',n,true); end if;
end $$;

create or replace function public.assign_customer_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := 'CUS-' || lpad(nextval('public.customer_code_seq')::text,5,'0');
  end if;
  return new;
end $$;

create or replace function public.assign_project_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.project_code is null or btrim(new.project_code) = '' then
    new.project_code := 'PRJ-' || lpad(nextval('public.project_code_seq')::text,5,'0');
  end if;
  return new;
end $$;

drop trigger if exists customers_assign_code on public.customers;
create trigger customers_assign_code before insert on public.customers
for each row execute function public.assign_customer_code();
drop trigger if exists projects_assign_code on public.projects;
create trigger projects_assign_code before insert on public.projects
for each row execute function public.assign_project_code();

alter table public.projects alter column customer_id drop not null;

create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  component_code text unique,
  component_type text,
  vendor text,
  version text,
  purpose text,
  status text not null default 'active' check (status in ('active','maintenance','retired','planned')),
  hosting_provider text,
  hosting_plan text,
  server_name text,
  server_type text,
  operating_system text,
  hosting_region text,
  production_url text,
  management_url text,
  domain_name text,
  domain_registrar text,
  domain_expiry_date date,
  dns_provider text,
  nameservers text[],
  source_control_platform text,
  repository_url text,
  documentation_url text,
  login_url text,
  account_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists components_name_trgm_idx on public.components using gin(name gin_trgm_ops);
create index if not exists components_customer_idx on public.components(customer_id);

create table if not exists public.project_component_links (
  project_id uuid not null references public.projects(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  relationship text,
  linked_at timestamptz not null default now(),
  primary key(project_id,component_id)
);
create index if not exists project_component_links_component_idx on public.project_component_links(component_id);

-- Preserve existing project-specific component records while moving them to the reusable model.
insert into public.components(id,customer_id,name,component_type,vendor,version,purpose,documentation_url,notes,created_at)
select pc.id,p.customer_id,pc.name,pc.component_type,pc.vendor,pc.version,pc.purpose,pc.documentation_url,pc.notes,pc.created_at
from public.project_components pc join public.projects p on p.id=pc.project_id
on conflict (id) do nothing;
insert into public.project_component_links(project_id,component_id,relationship)
select project_id,id,'Migrated from project component'
from public.project_components
on conflict do nothing;

alter table public.components enable row level security;
alter table public.project_component_links enable row level security;

drop policy if exists components_read on public.components;
create policy components_read on public.components for select to authenticated using (
  (select public.is_global_admin())
  or (customer_id is not null and public.can_read_customer(customer_id))
  or exists (select 1 from public.project_component_links l where l.component_id=id and public.can_read_project(l.project_id))
);
drop policy if exists components_insert on public.components;
create policy components_insert on public.components for insert to authenticated with check (
  (select public.is_global_admin())
  or (customer_id is not null and public.can_edit_customer(customer_id))
);
drop policy if exists components_update on public.components;
create policy components_update on public.components for update to authenticated using (
  (select public.is_global_admin())
  or (customer_id is not null and public.can_edit_customer(customer_id))
  or exists (select 1 from public.project_component_links l where l.component_id=id and public.can_edit_project(l.project_id))
) with check (
  (select public.is_global_admin())
  or (customer_id is not null and public.can_edit_customer(customer_id))
  or exists (select 1 from public.project_component_links l where l.component_id=id and public.can_edit_project(l.project_id))
);
drop policy if exists components_delete on public.components;
create policy components_delete on public.components for delete to authenticated using (
  (select public.is_global_admin())
  or (customer_id is not null and public.can_edit_customer(customer_id))
);

drop policy if exists project_component_links_read on public.project_component_links;
create policy project_component_links_read on public.project_component_links for select to authenticated
using (public.can_read_project(project_id));
drop policy if exists project_component_links_insert on public.project_component_links;
create policy project_component_links_insert on public.project_component_links for insert to authenticated
with check (public.can_edit_project(project_id));
drop policy if exists project_component_links_delete on public.project_component_links;
create policy project_component_links_delete on public.project_component_links for delete to authenticated
using (public.can_edit_project(project_id));

comment on table public.components is 'Reusable infrastructure and software components. A component may be shared by multiple projects or exist independently.';
comment on table public.project_component_links is 'Many-to-many links between projects and reusable components.';

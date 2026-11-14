-- Ekara Central: technical profile, operational task cards and task history
-- Run after 202611090003_project_attention.sql.

create table if not exists public.project_technical_profiles (
  project_id uuid primary key references public.projects(id) on delete cascade,
  architecture_type text,
  frontend_framework text,
  backend_framework text,
  programming_languages text[],
  database_technology text,
  architecture_diagram_url text,
  architecture_notes text,
  source_control_platform text,
  production_branch text,
  development_branch text,
  repository_owner text,
  ci_cd_platform text,
  deployment_instructions text,
  domain_name text,
  domain_registrar text,
  domain_expiry_date date,
  dns_provider text,
  nameservers text[],
  hosting_plan text,
  server_type text,
  operating_system text,
  hosting_region text,
  backup_provider text,
  backup_frequency text,
  ssl_provider text,
  ssl_installation_location text,
  ssl_management_url text,
  ssl_certificate_type text,
  ssl_expiry_date date,
  ssl_renewal_method text,
  ssl_responsible_contact text,
  support_contract_expiry date,
  maintenance_schedule text,
  known_issues text,
  recovery_instructions text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_technical_profiles enable row level security;
drop policy if exists project_technical_profiles_read on public.project_technical_profiles;
create policy project_technical_profiles_read on public.project_technical_profiles
  for select to authenticated using (public.can_read_project(project_id));
drop policy if exists project_technical_profiles_insert on public.project_technical_profiles;
create policy project_technical_profiles_insert on public.project_technical_profiles
  for insert to authenticated with check (public.can_edit_project(project_id));
drop policy if exists project_technical_profiles_update on public.project_technical_profiles;
create policy project_technical_profiles_update on public.project_technical_profiles
  for update to authenticated using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));
drop policy if exists project_technical_profiles_delete on public.project_technical_profiles;
create policy project_technical_profiles_delete on public.project_technical_profiles
  for delete to authenticated using (public.can_manage_project(project_id));

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'general'
    check (task_type in ('general','alert','requirement','maintenance','follow_up')),
  source_type text,
  source_id uuid,
  source_label text,
  priority text not null default 'normal'
    check (priority in ('critical','high','normal','low')),
  status text not null default 'open'
    check (status in ('open','in_progress','waiting','completed','cancelled')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_tasks_completed_timestamp_check
    check (status <> 'completed' or completed_at is not null)
);

create unique index if not exists project_tasks_source_unique
  on public.project_tasks(project_id, source_type, source_id)
  where source_type is not null and source_id is not null;
create index if not exists project_tasks_project_status_idx
  on public.project_tasks(project_id, status, priority);
create index if not exists project_tasks_due_idx
  on public.project_tasks(due_date) where status not in ('completed','cancelled');

alter table public.project_tasks enable row level security;
drop policy if exists project_tasks_read on public.project_tasks;
create policy project_tasks_read on public.project_tasks
  for select to authenticated using (public.can_read_project(project_id));
drop policy if exists project_tasks_insert on public.project_tasks;
create policy project_tasks_insert on public.project_tasks
  for insert to authenticated with check (public.can_edit_project(project_id));
drop policy if exists project_tasks_update on public.project_tasks;
create policy project_tasks_update on public.project_tasks
  for update to authenticated using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));
drop policy if exists project_tasks_delete on public.project_tasks;
create policy project_tasks_delete on public.project_tasks
  for delete to authenticated using (public.can_manage_project(project_id));

create table if not exists public.project_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  event_type text not null,
  details text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_task_events_task_idx
  on public.project_task_events(task_id, created_at desc);
alter table public.project_task_events enable row level security;
drop policy if exists project_task_events_read on public.project_task_events;
create policy project_task_events_read on public.project_task_events
  for select to authenticated using (
    exists (select 1 from public.project_tasks t
      where t.id = task_id and public.can_read_project(t.project_id))
  );
drop policy if exists project_task_events_insert on public.project_task_events;
create policy project_task_events_insert on public.project_task_events
  for insert to authenticated with check (
    exists (select 1 from public.project_tasks t
      where t.id = task_id and public.can_edit_project(t.project_id))
  );

-- Keep one derived attention item per project and expiry category.
create unique index if not exists project_attention_derived_expiry_unique
  on public.project_attention_items(project_id, category, title)
  where source = 'derived' and category in ('certificate','domain');

create or replace function public.sync_technical_profile_expiry_attention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ssl_expiry_date is not null then
    insert into public.project_attention_items
      (project_id, title, description, category, due_date, severity, status, source)
    values
      (new.project_id, 'SSL certificate renewal',
       'Review the SSL installation location, management URL, renewal method and responsible contact.',
       'certificate', new.ssl_expiry_date, 'high', 'open', 'derived')
    on conflict (project_id, category, title)
      where source = 'derived' and category in ('certificate','domain')
    do update set due_date = excluded.due_date,
      description = excluded.description,
      status = case when public.project_attention_items.status = 'resolved'
        then 'open' else public.project_attention_items.status end,
      resolved_at = case when public.project_attention_items.status = 'resolved'
        then null else public.project_attention_items.resolved_at end,
      updated_at = now();
  else
    update public.project_attention_items
      set status = 'resolved', resolved_at = now(), updated_at = now()
      where project_id = new.project_id and source = 'derived'
        and category = 'certificate' and title = 'SSL certificate renewal'
        and status <> 'resolved';
  end if;

  if new.domain_expiry_date is not null then
    insert into public.project_attention_items
      (project_id, title, description, category, due_date, severity, status, source)
    values
      (new.project_id, 'Domain renewal',
       'Review the domain registrar, DNS provider and renewal arrangements.',
       'domain', new.domain_expiry_date, 'high', 'open', 'derived')
    on conflict (project_id, category, title)
      where source = 'derived' and category in ('certificate','domain')
    do update set due_date = excluded.due_date,
      description = excluded.description,
      status = case when public.project_attention_items.status = 'resolved'
        then 'open' else public.project_attention_items.status end,
      resolved_at = case when public.project_attention_items.status = 'resolved'
        then null else public.project_attention_items.resolved_at end,
      updated_at = now();
  else
    update public.project_attention_items
      set status = 'resolved', resolved_at = now(), updated_at = now()
      where project_id = new.project_id and source = 'derived'
        and category = 'domain' and title = 'Domain renewal'
        and status <> 'resolved';
  end if;
  return new;
end;
$$;

drop trigger if exists project_technical_profile_expiry_attention
  on public.project_technical_profiles;
create trigger project_technical_profile_expiry_attention
  after insert or update of ssl_expiry_date, domain_expiry_date
  on public.project_technical_profiles
  for each row execute function public.sync_technical_profile_expiry_attention();

-- Turn each operational attention item into one persistent task card.
create or replace function public.sync_attention_item_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  task_status text;
begin
  task_status := case
    when new.status = 'resolved' then 'completed'
    when new.status = 'acknowledged' then 'in_progress'
    else 'open'
  end;

  insert into public.project_tasks
    (project_id, title, description, task_type, source_type, source_id,
     source_label, priority, status, due_date)
  values
    (new.project_id, new.title, new.description, 'alert', 'attention_item',
     new.id, 'Operational alert', new.severity, task_status, new.due_date)
  on conflict (project_id, source_type, source_id)
    where source_type is not null and source_id is not null
  do update set title = excluded.title,
    description = excluded.description,
    priority = excluded.priority,
    due_date = excluded.due_date,
    status = case
      when public.project_tasks.status = 'completed' and excluded.status <> 'completed'
        then excluded.status
      else excluded.status end,
    completed_at = case when excluded.status = 'completed'
      then coalesce(public.project_tasks.completed_at, now()) else null end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_attention_item_task_sync
  on public.project_attention_items;
create trigger project_attention_item_task_sync
  after insert or update of title, description, severity, due_date, status
  on public.project_attention_items
  for each row execute function public.sync_attention_item_task();

comment on table public.project_tasks is
  'Actionable task cards linked to project alerts, requirements and operational work. Designed to be extensible; time tracking and invoicing are intentionally out of scope.';
comment on column public.project_technical_profiles.ssl_installation_location is
  'Exact system where SSL is installed and managed, e.g. hosting control panel, Cloudflare, CDN or load balancer.';

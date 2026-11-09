-- Ekara Central: project priority and operational attention items
-- Run after 202611090002_project_integrity.sql.

alter table public.projects
  add column if not exists priority text not null default 'normal'
    check (priority in ('critical','high','normal','low'));

create table if not exists public.project_attention_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  component_id uuid references public.project_components(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'other'
    check (category in ('domain','certificate','hosting','licence','subscription','contract','security','milestone','review','other')),
  due_date date,
  severity text not null default 'normal'
    check (severity in ('critical','high','normal','low')),
  status text not null default 'open'
    check (status in ('open','acknowledged','resolved')),
  source text not null default 'manual'
    check (source in ('manual','derived')),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attention_resolved_timestamp_check
    check (status <> 'resolved' or resolved_at is not null)
);

create index if not exists project_attention_project_idx
  on public.project_attention_items(project_id);
create index if not exists project_attention_due_idx
  on public.project_attention_items(due_date)
  where status <> 'resolved';
create index if not exists project_attention_status_idx
  on public.project_attention_items(status, severity);

alter table public.project_attention_items enable row level security;

drop policy if exists project_attention_read on public.project_attention_items;
create policy project_attention_read
  on public.project_attention_items for select to authenticated
  using (public.can_read_project(project_id));

drop policy if exists project_attention_insert on public.project_attention_items;
create policy project_attention_insert
  on public.project_attention_items for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy if exists project_attention_update on public.project_attention_items;
create policy project_attention_update
  on public.project_attention_items for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

drop policy if exists project_attention_delete on public.project_attention_items;
create policy project_attention_delete
  on public.project_attention_items for delete to authenticated
  using (public.can_manage_project(project_id));

comment on table public.project_attention_items is
  'Project-level operational reminders and risks, such as domain and certificate expiries. Customer is contextual; project priority and item severity drive dashboard ordering.';
comment on column public.projects.priority is
  'Operational priority of this project: critical, high, normal or low. Separate from the severity of an individual attention item.';

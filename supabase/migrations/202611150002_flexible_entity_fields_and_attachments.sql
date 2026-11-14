-- Ekara Central: simple core records + extensible custom fields and private attachments
-- Apply after 202611150001_relationship_model_and_auto_codes.sql.
-- Safe to run once; statements are intentionally idempotent.

-- 1) Project status values requested by the new simple project form.
alter type public.project_status add value if not exists 'not_started';
alter type public.project_status add value if not exists 'ad_hoc';

-- 2) Keep the core forms deliberately small. Technical detail remains optional.
alter table public.projects
  add column if not exists source_control_notes text;
alter table public.project_technical_profiles
  add column if not exists architecture_description text,
  add column if not exists source_control_url text,
  add column if not exists source_control_notes text,
  add column if not exists database_url text,
  add column if not exists database_notes text;

comment on column public.project_access_references.vault_item_reference is
  'Reference to a password manager item only. Never store the password itself.';
comment on table public.project_environments is
  'One project can have zero, one or many environments (development, staging, production, etc.).';

-- 3) Components may be independent, customer-owned, or linked to multiple projects.
-- Make the optional relationship explicit and support the basic server/SSL fields.
alter table public.components
  add column if not exists ssl_provider text,
  add column if not exists ssl_installation_location text,
  add column if not exists ssl_management_url text,
  add column if not exists ssl_expiry_date date,
  add column if not exists ssl_renewal_method text,
  add column if not exists ssl_notes text;

-- 4) Custom field definitions.
-- scope='entity_type' means this field is available on all records of that type.
-- scope='record' means it is available only on the one selected record.
create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer','project','component')),
  scope text not null check (scope in ('entity_type','record')),
  entity_id uuid,
  field_key text not null,
  field_label text not null,
  field_type text not null check (field_type in ('text','long_text','date','attachment')),
  is_required boolean not null default false,
  display_order integer not null default 0,
  help_text text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_field_scope_entity_check check (
    (scope = 'entity_type' and entity_id is null) or
    (scope = 'record' and entity_id is not null)
  )
);
create unique index if not exists custom_field_global_key_unique
  on public.custom_field_definitions(entity_type, field_key)
  where scope = 'entity_type';
create unique index if not exists custom_field_record_key_unique
  on public.custom_field_definitions(entity_type, entity_id, field_key)
  where scope = 'record';
create index if not exists custom_field_definitions_entity_idx
  on public.custom_field_definitions(entity_type, entity_id, is_active);

-- 5) Custom field values. Values are JSON so text/date/attachment fields can be
-- represented without altering the customer/project/component tables.
create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  field_definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer','project','component')),
  entity_id uuid not null,
  value jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(field_definition_id, entity_type, entity_id)
);
create index if not exists custom_field_values_entity_idx
  on public.custom_field_values(entity_type, entity_id);
create index if not exists custom_field_values_field_idx
  on public.custom_field_values(field_definition_id);

-- Ensure a value is stored against the correct kind of record and the field
-- definition is either shared for that entity type or scoped to this record.
create or replace function public.validate_custom_field_value()
returns trigger language plpgsql security definer set search_path = '' as $$
declare f public.custom_field_definitions%rowtype;
begin
  select * into f from public.custom_field_definitions
   where id = new.field_definition_id and is_active;
  if not found or f.entity_type <> new.entity_type then
    raise exception 'Custom field definition does not match entity type or is inactive';
  end if;
  if f.scope = 'record' and f.entity_id <> new.entity_id then
    raise exception 'Record-scoped field cannot be used on another record';
  end if;
  if f.field_type = 'date' and new.value is not null
     and new.value <> 'null'::jsonb
     and (jsonb_typeof(new.value) <> 'string' or (new.value #>> '{}') !~ '^\\d{4}-\\d{2}-\\d{2}$') then
    raise exception 'Date custom fields must use YYYY-MM-DD';
  end if;
  if f.field_type in ('text','long_text') and new.value is not null
     and new.value <> 'null'::jsonb and jsonb_typeof(new.value) <> 'string' then
    raise exception 'Text custom fields must contain a string';
  end if;
  if f.field_type = 'attachment' and new.value is not null
     and new.value <> 'null'::jsonb and jsonb_typeof(new.value) <> 'array' then
    raise exception 'Attachment custom fields must contain an array of attachment IDs';
  end if;
  if new.entity_type = 'customer' and not exists(select 1 from public.customers where id=new.entity_id) then
    raise exception 'Customer record not found';
  elsif new.entity_type = 'project' and not exists(select 1 from public.projects where id=new.entity_id) then
    raise exception 'Project record not found';
  elsif new.entity_type = 'component' and not exists(select 1 from public.components where id=new.entity_id) then
    raise exception 'Component record not found';
  end if;
  return new;
end $$;
drop trigger if exists custom_field_value_validate on public.custom_field_values;
create trigger custom_field_value_validate before insert or update
on public.custom_field_values for each row execute function public.validate_custom_field_value();

-- 6) Private attachment metadata. The binary files live in a private Storage bucket.
create table if not exists public.entity_attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer','project','component')),
  entity_id uuid not null,
  field_definition_id uuid references public.custom_field_definitions(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  description text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists entity_attachments_entity_idx
  on public.entity_attachments(entity_type, entity_id);

-- Shared authorization helpers for custom values and attachments.
create or replace function public.can_read_entity(p_type text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if (select public.is_global_admin()) then return true; end if;
  if p_type = 'customer' then return public.can_read_customer(p_id); end if;
  if p_type = 'project' then return public.can_read_project(p_id); end if;
  if p_type = 'component' then
    return exists(select 1 from public.components c
      where c.id=p_id and c.customer_id is not null and public.can_read_customer(c.customer_id))
      or exists(select 1 from public.project_component_links l
      where l.component_id=p_id and public.can_read_project(l.project_id));
  end if;
  return false;
end $$;

create or replace function public.can_edit_entity(p_type text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if (select public.is_global_admin()) then return true; end if;
  if p_type = 'customer' then return public.can_edit_customer(p_id); end if;
  if p_type = 'project' then return public.can_edit_project(p_id); end if;
  if p_type = 'component' then
    return exists(select 1 from public.components c
      where c.id=p_id and c.customer_id is not null and public.can_edit_customer(c.customer_id))
      or exists(select 1 from public.project_component_links l
      where l.component_id=p_id and public.can_edit_project(l.project_id));
  end if;
  return false;
end $$;

revoke all on function public.can_read_entity(text,uuid) from public, anon;
revoke all on function public.can_edit_entity(text,uuid) from public, anon;
grant execute on function public.can_read_entity(text,uuid) to authenticated;
grant execute on function public.can_edit_entity(text,uuid) to authenticated;

-- Field definitions: shared definitions are readable by all signed-in users;
-- changes to the system-wide field catalogue are restricted to global admins.
alter table public.custom_field_definitions enable row level security;
drop policy if exists custom_field_definitions_read on public.custom_field_definitions;
create policy custom_field_definitions_read on public.custom_field_definitions
for select to authenticated using (
  (scope = 'entity_type' and is_active)
  or (scope = 'record' and public.can_read_entity(entity_type, entity_id))
  or (select public.is_global_admin())
);
drop policy if exists custom_field_definitions_insert on public.custom_field_definitions;
create policy custom_field_definitions_insert on public.custom_field_definitions
for insert to authenticated with check (
  (scope = 'entity_type' and (select public.is_global_admin()))
  or (scope = 'record' and public.can_edit_entity(entity_type, entity_id))
);
drop policy if exists custom_field_definitions_update on public.custom_field_definitions;
create policy custom_field_definitions_update on public.custom_field_definitions
for update to authenticated using (
  (scope = 'entity_type' and (select public.is_global_admin()))
  or (scope = 'record' and public.can_edit_entity(entity_type, entity_id))
) with check (
  (scope = 'entity_type' and (select public.is_global_admin()))
  or (scope = 'record' and public.can_edit_entity(entity_type, entity_id))
);
drop policy if exists custom_field_definitions_delete on public.custom_field_definitions;
create policy custom_field_definitions_delete on public.custom_field_definitions
for delete to authenticated using (
  (scope = 'entity_type' and (select public.is_global_admin()))
  or (scope = 'record' and public.can_edit_entity(entity_type, entity_id))
);

alter table public.custom_field_values enable row level security;
drop policy if exists custom_field_values_read on public.custom_field_values;
create policy custom_field_values_read on public.custom_field_values
for select to authenticated using (public.can_read_entity(entity_type, entity_id));
drop policy if exists custom_field_values_insert on public.custom_field_values;
create policy custom_field_values_insert on public.custom_field_values
for insert to authenticated with check (public.can_edit_entity(entity_type, entity_id));
drop policy if exists custom_field_values_update on public.custom_field_values;
create policy custom_field_values_update on public.custom_field_values
for update to authenticated using (public.can_edit_entity(entity_type, entity_id))
with check (public.can_edit_entity(entity_type, entity_id));
drop policy if exists custom_field_values_delete on public.custom_field_values;
create policy custom_field_values_delete on public.custom_field_values
for delete to authenticated using (public.can_edit_entity(entity_type, entity_id));

alter table public.entity_attachments enable row level security;
drop policy if exists entity_attachments_read on public.entity_attachments;
create policy entity_attachments_read on public.entity_attachments
for select to authenticated using (public.can_read_entity(entity_type, entity_id));
drop policy if exists entity_attachments_insert on public.entity_attachments;
create policy entity_attachments_insert on public.entity_attachments
for insert to authenticated with check (public.can_edit_entity(entity_type, entity_id));
drop policy if exists entity_attachments_delete on public.entity_attachments;
create policy entity_attachments_delete on public.entity_attachments
for delete to authenticated using (public.can_edit_entity(entity_type, entity_id));

-- Create a private bucket. Storage object paths must be:
-- customers/<customer-uuid>/<filename>
-- projects/<project-uuid>/<filename>
-- components/<component-uuid>/<filename>
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ekara-attachments','ekara-attachments',false,52428800,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false,file_size_limit=52428800;

drop policy if exists ekara_attachments_read on storage.objects;
create policy ekara_attachments_read on storage.objects for select to authenticated
using (
  bucket_id='ekara-attachments' and
  (case (storage.foldername(name))[1]
    when 'customers' then public.can_read_entity('customer', nullif((storage.foldername(name))[2],'')::uuid)
    when 'projects' then public.can_read_entity('project', nullif((storage.foldername(name))[2],'')::uuid)
    when 'components' then public.can_read_entity('component', nullif((storage.foldername(name))[2],'')::uuid)
    else false end)
);
drop policy if exists ekara_attachments_insert on storage.objects;
create policy ekara_attachments_insert on storage.objects for insert to authenticated
with check (
  bucket_id='ekara-attachments' and
  (case (storage.foldername(name))[1]
    when 'customers' then public.can_edit_entity('customer', nullif((storage.foldername(name))[2],'')::uuid)
    when 'projects' then public.can_edit_entity('project', nullif((storage.foldername(name))[2],'')::uuid)
    when 'components' then public.can_edit_entity('component', nullif((storage.foldername(name))[2],'')::uuid)
    else false end)
);
drop policy if exists ekara_attachments_update on storage.objects;
create policy ekara_attachments_update on storage.objects for update to authenticated
using (
  bucket_id='ekara-attachments' and
  (case (storage.foldername(name))[1]
    when 'customers' then public.can_edit_entity('customer', nullif((storage.foldername(name))[2],'')::uuid)
    when 'projects' then public.can_edit_entity('project', nullif((storage.foldername(name))[2],'')::uuid)
    when 'components' then public.can_edit_entity('component', nullif((storage.foldername(name))[2],'')::uuid)
    else false end)
) with check (
  bucket_id='ekara-attachments' and
  (case (storage.foldername(name))[1]
    when 'customers' then public.can_edit_entity('customer', nullif((storage.foldername(name))[2],'')::uuid)
    when 'projects' then public.can_edit_entity('project', nullif((storage.foldername(name))[2],'')::uuid)
    when 'components' then public.can_edit_entity('component', nullif((storage.foldername(name))[2],'')::uuid)
    else false end)
);
drop policy if exists ekara_attachments_delete on storage.objects;
create policy ekara_attachments_delete on storage.objects for delete to authenticated
using (
  bucket_id='ekara-attachments' and
  (case (storage.foldername(name))[1]
    when 'customers' then public.can_edit_entity('customer', nullif((storage.foldername(name))[2],'')::uuid)
    when 'projects' then public.can_edit_entity('project', nullif((storage.foldername(name))[2],'')::uuid)
    when 'components' then public.can_edit_entity('component', nullif((storage.foldername(name))[2],'')::uuid)
    else false end)
);

comment on table public.custom_field_definitions is
  'Custom field catalogue. entity_type scope applies to every record of a type; record scope applies to one record only.';
comment on table public.custom_field_values is
  'Typed custom field values stored separately from core entities.';
comment on table public.entity_attachments is
  'Private uploaded file metadata; file bytes are stored in the private ekara-attachments Supabase Storage bucket.';

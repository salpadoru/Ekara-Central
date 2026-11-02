-- Ekara Central initial relational schema
-- Apply in Supabase SQL Editor. Never store raw passwords/API keys here.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.record_status as enum ('active','inactive','archived');
create type public.project_status as enum ('planning','active','on_hold','completed','support','archived');
create type public.knowledge_scope as enum ('global','customer','project');
create type public.knowledge_kind as enum ('article','runbook','procedure','troubleshooting','guide','reference');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('admin','manager','member','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_code text unique,
  status public.record_status not null default 'active',
  website_url text,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_trgm_idx on public.customers using gin (name gin_trgm_ops);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index customer_contacts_customer_idx on public.customer_contacts(customer_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  name text not null,
  project_code text unique,
  summary text,
  requirements text,
  status public.project_status not null default 'planning',
  project_type text,
  start_date date,
  target_date date,
  repository_url text,
  production_url text,
  staging_url text,
  development_url text,
  hosting_provider text,
  hosting_account_ref text,
  primary_contact_id uuid references public.customer_contacts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_customer_idx on public.projects(customer_id);
create index projects_name_trgm_idx on public.projects using gin (name gin_trgm_ops);

create table public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  full_name text not null,
  role_title text,
  organisation text,
  email text,
  phone text,
  contact_type text not null default 'customer',
  notes text,
  created_at timestamptz not null default now()
);

create table public.project_components (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  component_type text,
  vendor text,
  version text,
  purpose text,
  license_name text,
  license_url text,
  documentation_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.project_environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  environment_type text not null check (environment_type in ('development','test','staging','production','other')),
  url text,
  hosting_provider text,
  server_name text,
  region text,
  deployment_method text,
  repository_branch text,
  last_deployed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.project_access_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  environment_id uuid references public.project_environments(id) on delete set null,
  system_name text not null,
  login_url text,
  username_or_account text,
  vault_item_reference text,
  access_process text,
  owner_contact text,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.project_access_references is 'Store vault references and access instructions only. Never store passwords, tokens, private keys or recovery codes.';

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  document_type text not null default 'other',
  storage_path text,
  external_url text,
  description text,
  version_label text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text not null,
  kind public.knowledge_kind not null default 'article',
  scope public.knowledge_scope not null default 'global',
  customer_id uuid references public.customers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  status public.record_status not null default 'active',
  tags text[] not null default '{}',
  symptoms text,
  resolution text,
  related_urls text[] not null default '{}',
  review_due_at date,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(symptoms,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(resolution,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(body,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags,' '),'')), 'A')
  ) stored,
  constraint knowledge_scope_link_check check (
    (scope = 'global' and customer_id is null and project_id is null) or
    (scope = 'customer' and customer_id is not null and project_id is null) or
    (scope = 'project' and project_id is not null)
  )
);
create index knowledge_search_idx on public.knowledge_articles using gin(search_document);
create index knowledge_title_trgm_idx on public.knowledge_articles using gin(title gin_trgm_ops);
create index knowledge_customer_idx on public.knowledge_articles(customer_id);
create index knowledge_project_idx on public.knowledge_articles(project_id);

create table public.knowledge_article_links (
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  related_article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  relationship text not null default 'related',
  primary key(article_id, related_article_id),
  check(article_id <> related_article_id)
);

-- Search results support both exact/full-text matches and fuzzy title/tag matching.
create or replace function public.search_knowledge(search_text text, result_limit integer default 8)
returns table (
  id uuid, title text, summary text, kind public.knowledge_kind,
  scope public.knowledge_scope, customer_id uuid, project_id uuid,
  tags text[], rank real
)
language sql stable security invoker set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(search_text,'')) as ts,
           plainto_tsquery('english', coalesce(search_text,'')) as plain
  )
  select a.id, a.title, a.summary, a.kind, a.scope, a.customer_id, a.project_id, a.tags,
    greatest(
      ts_rank_cd(a.search_document, q.ts),
      similarity(a.title, search_text) * 0.65,
      similarity(array_to_string(a.tags,' '), search_text) * 0.45
    )::real as rank
  from public.knowledge_articles a cross join q
  where a.status = 'active'
    and (
      a.search_document @@ q.ts
      or a.search_document @@ q.plain
      or a.title % search_text
      or array_to_string(a.tags,' ') % search_text
    )
  order by rank desc, a.updated_at desc
  limit greatest(1, least(coalesce(result_limit,8), 25));
$$;

-- Authenticated users can work with records. Fine-grained customer/project membership
-- policies should replace these baseline policies before onboarding external users.
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_contacts enable row level security;
alter table public.project_components enable row level security;
alter table public.project_environments enable row level security;
alter table public.project_access_references enable row level security;
alter table public.project_documents enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_links enable row level security;

create policy "authenticated users read profiles" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['customers','customer_contacts','projects','project_contacts','project_components','project_environments','project_access_references','project_documents','knowledge_articles','knowledge_article_links']
  loop
    execute format('create policy "%I authenticated read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%I authenticated insert" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('create policy "%I authenticated update" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('create policy "%I authenticated delete" on public.%I for delete to authenticated using (true)', t, t);
  end loop;
end $$;

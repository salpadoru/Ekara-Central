-- Ekara Central: project-scoped access foundation
-- Run AFTER 202611020001_initial_schema.sql.
-- IMPORTANT: Before enabling other users, designate your own admin profile using
-- the one-time SQL shown in docs/ACCESS_SETUP.md.
-- Existing broad policies are removed by this migration.

create table if not exists public.project_memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('project_admin','member','viewer')),
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_memberships_user_idx on public.project_memberships(user_id);
alter table public.project_memberships enable row level security;

-- Functions run as the schema owner to avoid membership-policy recursion.
-- Always set an explicit search_path and fully qualify tables.
create or replace function public.is_global_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.project_role(p_project_id uuid)
returns text language sql stable security definer
set search_path = '' as $$
  select m.role from public.project_memberships m
  where m.project_id = p_project_id and m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.can_read_project(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select (select public.is_global_admin())
    or (select public.project_role(p_project_id)) is not null;
$$;

create or replace function public.can_edit_project(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select (select public.is_global_admin())
    or (select public.project_role(p_project_id)) in ('project_admin','member');
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select (select public.is_global_admin())
    or (select public.project_role(p_project_id)) = 'project_admin';
$$;

create or replace function public.can_read_customer(p_customer_id uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select (select public.is_global_admin()) or exists (
    select 1 from public.projects p
    join public.project_memberships m on m.project_id = p.id
    where p.customer_id = p_customer_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_customer(p_customer_id uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select (select public.is_global_admin()) or exists (
    select 1 from public.projects p
    join public.project_memberships m on m.project_id = p.id
    where p.customer_id = p_customer_id
      and m.user_id = (select auth.uid()) and m.role = 'project_admin'
  );
$$;

-- Prevent ordinary users from invoking security-definer helpers anonymously.
revoke all on function public.is_global_admin() from public, anon;
revoke all on function public.project_role(uuid) from public, anon;
revoke all on function public.can_read_project(uuid) from public, anon;
revoke all on function public.can_edit_project(uuid) from public, anon;
revoke all on function public.can_manage_project(uuid) from public, anon;
revoke all on function public.can_read_customer(uuid) from public, anon;
revoke all on function public.can_edit_customer(uuid) from public, anon;
grant execute on function public.is_global_admin() to authenticated;
grant execute on function public.project_role(uuid) to authenticated;
grant execute on function public.can_read_project(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;
grant execute on function public.can_read_customer(uuid) to authenticated;
grant execute on function public.can_edit_customer(uuid) to authenticated;

-- Remove all old policies, including the original 'authenticated read/write' rules.
do $$
declare rec record;
begin
  for rec in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any(array[
      'profiles','customers','customer_contacts','projects','project_contacts',
      'project_components','project_environments','project_access_references',
      'project_documents','knowledge_articles','knowledge_article_links',
      'project_memberships'
    ])
  loop
    execute format('drop policy if exists %I on %I.%I',
      rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end $$;

-- Profiles: users can see their own profile; admins can see/manage all.
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_global_admin()));
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check ((select public.is_global_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using ((select public.is_global_admin()));

-- Create a profile on signup without granting users permission to set their own role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_ekara on auth.users;
create trigger on_auth_user_created_ekara
after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles for already-created accounts (all default to viewer).
insert into public.profiles(id, display_name, role)
select id, email, 'viewer' from auth.users
on conflict (id) do nothing;

-- Only global admins can create or delete customers/projects.
create policy customers_read on public.customers for select to authenticated
  using (public.can_read_customer(id));
create policy customers_insert on public.customers for insert to authenticated
  with check ((select public.is_global_admin()));
create policy customers_update on public.customers for update to authenticated
  using (public.can_edit_customer(id)) with check (public.can_edit_customer(id));
create policy customers_delete on public.customers for delete to authenticated
  using ((select public.is_global_admin()));

create policy projects_read on public.projects for select to authenticated
  using (public.can_read_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check ((select public.is_global_admin()));
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy projects_delete on public.projects for delete to authenticated
  using ((select public.is_global_admin()));

-- Only admins and project admins can assign project membership.
create policy memberships_read on public.project_memberships for select to authenticated
  using (public.can_read_project(project_id));
create policy memberships_insert on public.project_memberships for insert to authenticated
  with check (public.can_manage_project(project_id));
create policy memberships_update on public.project_memberships for update to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
create policy memberships_delete on public.project_memberships for delete to authenticated
  using (public.can_manage_project(project_id));

-- Project-owned tables: read assigned projects; write if member or above.
do $$
declare t text;
begin
  foreach t in array array[
    'project_contacts','project_components','project_environments',
    'project_access_references','project_documents'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_read_project(project_id))', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_project(project_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_project(project_id))', t||'_delete', t);
  end loop;
end $$;

create policy contacts_read on public.customer_contacts for select to authenticated
  using (public.can_read_customer(customer_id));
create policy contacts_insert on public.customer_contacts for insert to authenticated
  with check (public.can_edit_customer(customer_id));
create policy contacts_update on public.customer_contacts for update to authenticated
  using (public.can_edit_customer(customer_id))
  with check (public.can_edit_customer(customer_id));
create policy contacts_delete on public.customer_contacts for delete to authenticated
  using (public.can_edit_customer(customer_id));

-- Knowledge visibility follows its scope. Global articles are readable by signed-in users.
create policy knowledge_read on public.knowledge_articles for select to authenticated
  using (
    (scope = 'global')
    or (scope = 'customer' and public.can_read_customer(customer_id))
    or (scope = 'project' and public.can_read_project(project_id))
  );
create policy knowledge_insert on public.knowledge_articles for insert to authenticated
  with check (
    (scope = 'global' and (select public.is_global_admin()))
    or (scope = 'customer' and public.can_edit_customer(customer_id))
    or (scope = 'project' and public.can_edit_project(project_id))
  );
create policy knowledge_update on public.knowledge_articles for update to authenticated
  using (
    (scope = 'global' and (select public.is_global_admin()))
    or (scope = 'customer' and public.can_edit_customer(customer_id))
    or (scope = 'project' and public.can_edit_project(project_id))
  )
  with check (
    (scope = 'global' and (select public.is_global_admin()))
    or (scope = 'customer' and public.can_edit_customer(customer_id))
    or (scope = 'project' and public.can_edit_project(project_id))
  );
create policy knowledge_delete on public.knowledge_articles for delete to authenticated
  using (
    (scope = 'global' and (select public.is_global_admin()))
    or (scope = 'customer' and public.can_edit_customer(customer_id))
    or (scope = 'project' and public.can_manage_project(project_id))
  );

create policy links_read on public.knowledge_article_links for select to authenticated
  using (
    exists (select 1 from public.knowledge_articles a where a.id = article_id)
    and exists (select 1 from public.knowledge_articles b where b.id = related_article_id)
  );
create policy links_insert on public.knowledge_article_links for insert to authenticated
  with check (
    exists (select 1 from public.knowledge_articles a where a.id = article_id
      and ((a.scope = 'global' and (select public.is_global_admin()))
        or (a.scope = 'customer' and public.can_edit_customer(a.customer_id))
        or (a.scope = 'project' and public.can_edit_project(a.project_id))))
    and exists (select 1 from public.knowledge_articles b where b.id = related_article_id)
  );
create policy links_delete on public.knowledge_article_links for delete to authenticated
  using (
    exists (select 1 from public.knowledge_articles a where a.id = article_id
      and ((a.scope = 'global' and (select public.is_global_admin()))
        or (a.scope = 'customer' and public.can_edit_customer(a.customer_id))
        or (a.scope = 'project' and public.can_edit_project(a.project_id))))
  );

-- The existing search_knowledge() is SECURITY INVOKER; its results respect RLS.

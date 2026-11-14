-- Keep project ownership and customer linkage under project-admin control.
-- A regular member may edit project content through the project child tables,
-- but must not reassign a project to a different customer.
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

-- Project-scoped articles must not point to an unrelated customer.
-- This guards against misleading cross-customer links in the knowledge index.
create or replace function public.validate_knowledge_customer()
returns trigger language plpgsql set search_path = '' as $$
declare linked_customer uuid;
begin
  if new.scope = 'project' and new.customer_id is not null then
    select p.customer_id into linked_customer from public.projects p where p.id = new.project_id;
    if linked_customer is distinct from new.customer_id then
      raise exception 'Project knowledge customer_id must match the project customer';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists knowledge_customer_consistency on public.knowledge_articles;
create trigger knowledge_customer_consistency
before insert or update on public.knowledge_articles
for each row execute function public.validate_knowledge_customer();

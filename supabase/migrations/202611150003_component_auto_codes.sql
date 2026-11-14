-- Automatic component numbers, matching customer and project numbering.
create sequence if not exists public.component_code_seq;

do $$
declare n bigint;
begin
  select coalesce(max(nullif(regexp_replace(component_code, '[^0-9]', '', 'g'), '')::bigint),0)
    into n from public.components;
  if n = 0 then perform setval('public.component_code_seq',1,false);
  else perform setval('public.component_code_seq',n,true); end if;
end $$;

create or replace function public.assign_component_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.component_code is null or btrim(new.component_code) = '' then
    new.component_code := 'CMP-' || lpad(nextval('public.component_code_seq')::text,5,'0');
  end if;
  return new;
end $$;

drop trigger if exists components_assign_code on public.components;
create trigger components_assign_code before insert on public.components
for each row execute function public.assign_component_code();

update public.components
set component_code = 'CMP-' || lpad(nextval('public.component_code_seq')::text,5,'0')
where component_code is null or btrim(component_code) = '';

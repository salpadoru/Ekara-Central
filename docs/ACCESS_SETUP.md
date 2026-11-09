# Ekara Central — access foundation

Development branch: `feature/project-access-foundation`

## What has been prepared
- A project membership table with `project_admin`, `member`, and `viewer` roles.
- A global administrator role using `profiles.role = 'admin'`.
- Supabase RLS policies that limit customers, projects, contacts, components, access references, documents and knowledge to authorised projects.
- New accounts receive a `viewer` profile automatically.
- The existing `search_knowledge` function is security-invoker and therefore respects these policies.

## Apply the SQL
**Do not run the initial schema again.** In Supabase SQL Editor, run these two new files **in order**:
1. `supabase/migrations/202611090001_project_access.sql`
2. `supabase/migrations/202611090002_project_integrity.sql`

These are schema changes, not a UI feature. They have NOT been applied to your live Supabase project by committing to GitHub.

## Promote your account to global admin
First, create/sign in to your Supabase Auth account. In Supabase SQL Editor, check the account:

```sql
select id, email from auth.users order by created_at desc;
```

Verify your email and use **that exact email** in this command:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR-EXACT-EMAIL@example.com');
```

Then verify:

```sql
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where u.email = 'YOUR-EXACT-EMAIL@example.com';
```

Only promote an account you control. Never expose a service-role/secret API key in the browser.

## Assign another user to a project
After the user signs up, a global admin can run (until the admin UI is implemented):

```sql
insert into public.project_memberships(project_id, user_id, role)
select p.id, u.id, 'viewer'
from public.projects p cross join auth.users u
where p.name = 'EXACT PROJECT NAME'
  and u.email = 'USER@example.com'
on conflict (project_id, user_id)
do update set role = excluded.role;
```

Use `project_admin`, `member`, or `viewer` as the role.

## Important
- The original schema's RLS policies granted broad access to every authenticated user. These migrations replace those policies.
- Until you promote an admin, normal accounts will not see customer/project records.
- Do not invite users until RLS has been applied and verified.
- Keep actual passwords, tokens, recovery codes and private keys in a dedicated vault, not in Ekara's text fields.
- Supabase Storage needs **separate private bucket and object policies** before document uploads are enabled.
- The current dashboard still contains demonstration data; next work is the actual authentication and customer/project UI.

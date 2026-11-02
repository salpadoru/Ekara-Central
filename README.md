# Ekara Central

Customer, project and operational knowledge hub.

## Stack
- Next.js App Router + TypeScript
- Supabase PostgreSQL, Auth and Storage
- PostgreSQL full-text search + trigram matching for live knowledge suggestions

## Run locally
```bash
npm install
npm run dev
```

## Database setup
1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/202611020001_initial_schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon/publishable key.
4. Restart the dev server after changing environment variables.

The migration creates customer/contact, project, environment, component, access-reference, document and knowledge article tables, plus a sitewide fuzzy/full-text search function.

## Security
- Do not store raw passwords, API keys, private keys, tokens or recovery codes in the app database.
- Store secrets in a password manager and keep only approved vault references and access procedures.
- The initial RLS policies assume authenticated internal users. Before external/customer access, replace them with role- and customer/project-membership-based policies.
- Supabase service-role keys must remain server-only and must never use a `NEXT_PUBLIC_` prefix.

## Current status
The UI mockup remains in place. The first database schema and typed domain models are committed; the next implementation step is wiring authenticated CRUD and live knowledge search into the UI.

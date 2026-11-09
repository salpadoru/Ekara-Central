# Project attention tracking

Run `supabase/migrations/202611090003_project_attention.sql` in the Supabase SQL Editor after migrations 001 and 002.

This adds:
- A project-level priority (critical, high, normal, low).
- Project-linked attention items for expiries, renewals, reviews, milestones and risks.
- An independent severity and status for each attention item.
- Project membership RLS policies for reading and maintaining attention items.

The customer is contextual only. Dashboard ordering should use project priority and individual item severity, not customer-level priority.

Dates that have not been confirmed must remain null. Do not infer expiry dates. Raw passwords, tokens, private keys and recovery codes must never be stored in attention items or project records.

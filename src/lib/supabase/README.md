# Supabase client setup

1. Copy the repository's `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Project Settings → API.
3. Run `npm install` after pulling the dependency update.
4. Restart Next.js with `npm run dev`.

Only the Supabase publishable/anon key belongs in the browser. Never add a service-role key to a `NEXT_PUBLIC_` variable.

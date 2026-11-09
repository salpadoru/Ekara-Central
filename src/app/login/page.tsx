"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace("/");
  }

  const missingConfig = searchParams.get("setup") === "missing";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f7fb", color: "#182230" }}>
      <section style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #e5eaf1", borderRadius: 18, padding: 36, boxShadow: "0 18px 55px rgba(24,34,48,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", color: "#fff", fontSize: 23, fontWeight: 800, background: "linear-gradient(145deg,#356de6,#1d4db7)" }}>E</div>
          <div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>Ekara Central</div><div style={{ color: "#8290a3", fontSize: 13 }}>Project Knowledge Hub</div></div>
        </div>
        <h1 style={{ fontSize: 28, margin: "0 0 8px", letterSpacing: "-.7px" }}>Welcome back</h1>
        <p style={{ margin: "0 0 26px", color: "#718096", lineHeight: 1.5 }}>Sign in to access your customers, projects and operational knowledge.</p>
        {missingConfig && <p style={{ padding: 12, borderRadius: 9, background: "#fff6e6", color: "#895b12", fontSize: 13 }}>Supabase connection settings are missing. Add the project URL and anon key to your local environment file, then restart the development server.</p>}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 7, fontSize: 14, fontWeight: 650 }}>Email address
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ height: 48, border: "1px solid #dce3ed", borderRadius: 9, padding: "0 13px", outlineColor: "#356de6", fontSize: 16 }} />
          </label>
          <label style={{ display: "grid", gap: 7, fontSize: 14, fontWeight: 650 }}>Password
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={{ height: 48, border: "1px solid #dce3ed", borderRadius: 9, padding: "0 13px", outlineColor: "#356de6", fontSize: 16 }} />
          </label>
          {error && <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 9, background: "#fff0f0", color: "#a83232", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ height: 50, border: 0, borderRadius: 9, background: loading ? "#7898dc" : "#285bc8", color: "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "wait" : "pointer", marginTop: 4 }}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p style={{ margin: "22px 0 0", textAlign: "center", color: "#9aa4b2", fontSize: 12 }}>Access is managed by your Ekara Central administrator.</p>
      </section>
    </main>
  );
}

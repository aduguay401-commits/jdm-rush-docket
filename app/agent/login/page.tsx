"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

async function getUserRole(userId: string, supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Agent Login] Profile lookup error", error);
    return null;
  }

  return data?.role ? (data.role as string) : null;
}

export default function AgentLoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    const { data: userResponse } = await supabase.auth.getUser();
    const user = userResponse.user;

    if (!user) {
      setError("Unable to load user profile.");
      setLoading(false);
      return;
    }

    const role = await getUserRole(user.id, supabase);

    if (role === "admin") {
      router.push("/admin/dashboard");
      return;
    }

    router.push("/agent/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#E55125]">
            JDM Rush
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Export Agent Portal</h1>
          <p className="mt-2 text-xs text-white/60">Admin users are redirected to the admin dashboard after sign-in.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSignIn}>
          <label className="block text-sm text-white/85">
            Email
            <input
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm text-white/85">
            Password
            <input
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            className="w-full rounded-lg bg-[#E55125] px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

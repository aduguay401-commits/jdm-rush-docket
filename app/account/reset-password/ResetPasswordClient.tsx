"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ErrorBanner, SentStateCard } from "@/app/account/_components/AuthUi";
import { PasswordInput } from "@/app/account/_components/PasswordInput";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ResetStatus = "checking" | "ready" | "invalid" | "saving" | "success";

export function ResetPasswordClient() {
  const router = useRouter();
  const [status, setStatus] = useState<ResetStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      const supabase = createBrowserSupabaseClient();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const authError = params.get("error") ?? params.get("error_code");

      if (authError) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setStatus("invalid");
          return;
        }

        window.history.replaceState({}, "", window.location.pathname);
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      if (!cancelled) setStatus("ready");
    }

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setStatus("saving");
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("This reset link has expired or is invalid.");
      setStatus("invalid");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatus("success");
  }

  if (status === "checking") {
    return (
      <div className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 text-white/60 text-[13px]">
        Checking your reset link...
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
        <ErrorBanner>{error || "This reset link has expired or is invalid."}</ErrorBanner>
        <Link href="/account/forgot-password" className="text-[#E55125] hover:brightness-110 text-[13px]">
          Request a new reset link →
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <SentStateCard
        label="PASSWORD UPDATED"
        heading="You're all set"
        body="Your password has been updated. You can now continue to your garage."
        cta={
          <button
            type="button"
            onClick={() => router.push("/account")}
            className="w-full sm:w-auto inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
          >
            Continue to My Garage
          </button>
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <PasswordInput
        id="customer-new-password"
        label="New Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        disabled={status === "saving"}
        placeholder="••••••••"
        autoComplete="new-password"
        helperText="Minimum 8 characters"
      />

      <PasswordInput
        id="customer-confirm-new-password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        required
        disabled={status === "saving"}
        placeholder="••••••••"
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
      >
        {status === "saving" ? "Saving..." : "Reset Password"}
      </button>
    </form>
  );
}

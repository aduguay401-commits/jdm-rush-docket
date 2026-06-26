"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { PasswordInput } from "@/app/account/_components/PasswordInput";
import { getCustomerAuthCallbackUrl } from "@/lib/customer/auth-shared";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function OrDivider() {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/[0.08]" />
      </div>
      <div className="relative flex justify-center">
        <span className="px-4 bg-black text-white/30 text-[12px]">or</span>
      </div>
    </div>
  );
}

export function LoginClient({ nextPath, errorMessage }: { nextPath: string; errorMessage?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorMessage ?? "");
  const [loadingMode, setLoadingMode] = useState<"password" | "google" | null>(null);
  const isLoading = loadingMode !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoadingMode("password");

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Invalid email or password.");
      setLoadingMode(null);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoadingMode("google");

    const supabase = createBrowserSupabaseClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getCustomerAuthCallbackUrl(nextPath),
      },
    });

    if (oauthError) {
      setError("An error occurred. Please try again.");
      setLoadingMode(null);
    }
  }

  return (
    <div className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
      {error ? (
        <div role="alert" className="border border-amber-400/25 bg-amber-400/[0.04] px-4 py-3 text-amber-400 text-[13px]">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="customer-email" className="text-white/50 text-[12px] font-medium">
            Email address
          </label>
          <input
            id="customer-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            className="mt-2 w-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 text-white/80 placeholder:text-white/20 text-[14px] outline-none focus:border-[#E55125]/50 disabled:opacity-60"
            placeholder="you@example.com"
          />
        </div>

        <PasswordInput
          id="customer-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={isLoading}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <div className="-mt-2 text-right">
          <Link href="/account/forgot-password" className="text-[#E55125] hover:brightness-110 text-[12px]">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
        >
          {loadingMode === "password" ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <OrDivider />

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full py-3 px-4 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-[14px] font-semibold transition-colors flex items-center justify-center gap-3 border border-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
      >
        <GoogleIcon />
        {loadingMode === "google" ? "Opening Google..." : "Sign in with Google"}
      </button>

      <p className="text-center text-white/50 text-[13px] mt-2">
        Don&apos;t have an account?{" "}
        <Link href="/account/register" className="text-[#E55125] hover:brightness-110 font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}

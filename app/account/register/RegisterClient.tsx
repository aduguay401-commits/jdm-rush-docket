"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ErrorBanner, GoogleIcon, OrDivider, SentStateCard } from "@/app/account/_components/AuthUi";
import { PasswordInput } from "@/app/account/_components/PasswordInput";
import { getCustomerAuthCallbackUrl } from "@/lib/customer/auth-shared";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function RegisterClient({ initialEmail = "", nextPath }: { initialEmail?: string; nextPath: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [error, setError] = useState("");
  const [loadingMode, setLoadingMode] = useState<"password" | "google" | null>(null);
  const isLoading = loadingMode !== null;

  function resetForm() {
    setEmail(sentEmail);
    setSentEmail("");
    setError("");
    setLoadingMode(null);
  }

  function validateForm() {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const phoneDigits = phone.replace(/\D/g, "");

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      return "Please fill in all required fields";
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return "Please enter a valid email address";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match";
    }

    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      return "Please enter a complete 10-digit phone number";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoadingMode("password");
    const normalizedEmail = email.trim().toLowerCase();
    const phoneDigits = phone.replace(/\D/g, "");
    const { firstName, lastName } = splitFullName(fullName);
    const supabase = createBrowserSupabaseClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getCustomerAuthCallbackUrl(nextPath),
        data: {
          role: "customer",
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          ...(phoneDigits ? { phone: phoneDigits } : {}),
        },
      },
    });

    if (signUpError) {
      setError("An error occurred. Please try again.");
      setLoadingMode(null);
      return;
    }

    setSentEmail(normalizedEmail);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setLoadingMode(null);
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

  if (sentEmail) {
    return (
      <SentStateCard
        label="CHECK YOUR INBOX"
        heading="Verify your email"
        body={
          <>
            We sent a confirmation email to <span className="text-white font-semibold">{sentEmail}</span>. Click the link to activate your account.
          </>
        }
        footerHint="Check spam if it doesn't show up within a minute."
        footerAction={
          <button
            type="button"
            onClick={resetForm}
            className="shrink-0 text-[#E55125] hover:brightness-110 text-[12px] font-medium transition-all text-left sm:text-right"
          >
            Use a different email
          </button>
        }
      />
    );
  }

  return (
    <div className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="customer-full-name" className="text-white/50 text-[12px] font-medium">
            Full Name
          </label>
          <input
            id="customer-full-name"
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={isLoading}
            className="mt-2 w-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 text-white/80 placeholder:text-white/20 text-[14px] outline-none focus:border-[#E55125]/50 disabled:opacity-60"
            placeholder="John Doe"
          />
        </div>

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

        <div>
          <label htmlFor="customer-phone" className="text-white/50 text-[12px] font-medium">
            Phone Number <span className="text-white/30 font-normal">(optional)</span>
          </label>
          <input
            id="customer-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            disabled={isLoading}
            className="mt-2 w-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 text-white/80 placeholder:text-white/20 text-[14px] outline-none focus:border-[#E55125]/50 disabled:opacity-60"
            placeholder="(204) 555-0123"
          />
          <p className="text-white/30 text-[11px] mt-1">Canadian &amp; US numbers only</p>
        </div>

        <PasswordInput
          id="customer-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={isLoading}
          placeholder="••••••••"
          autoComplete="new-password"
          helperText="Minimum 8 characters"
        />

        <PasswordInput
          id="customer-confirm-password"
          label="Confirm Password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          disabled={isLoading}
          placeholder="••••••••"
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
        >
          {loadingMode === "password" ? "Creating account..." : "Create Account"}
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
        {loadingMode === "google" ? "Opening Google..." : "Sign up with Google"}
      </button>

      <p className="text-center text-white/50 text-[13px] mt-2">
        Already have an account?{" "}
        <Link href="/account/login" className="text-[#E55125] hover:brightness-110 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

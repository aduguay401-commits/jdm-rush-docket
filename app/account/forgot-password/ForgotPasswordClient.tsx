"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { SentStateCard } from "@/app/account/_components/AuthUi";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAppBaseUrl } from "@/lib/urls";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  function resetForm() {
    setEmail(sentEmail);
    setSentEmail("");
    setIsSending(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setIsSending(true);

    const supabase = createBrowserSupabaseClient();
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getAppBaseUrl()}/account/reset-password`,
    });

    setSentEmail(normalizedEmail);
    setEmail("");
    setIsSending(false);
  }

  if (sentEmail) {
    return (
      <>
        <SentStateCard
          label="RESET LINK SENT"
          heading="Check your inbox"
          body={
            <>
              If an account exists for <span className="text-white font-semibold">{sentEmail}</span>, we sent a password reset link. The link expires in 1 hour.
            </>
          }
          footerHint="Check spam if it doesn't show up."
          footerAction={
            <button
              type="button"
              onClick={resetForm}
              className="shrink-0 text-[#E55125] hover:brightness-110 text-[12px] font-medium transition-all text-left sm:text-right"
            >
              Resend / use a different email
            </button>
          }
        />
        <div className="text-center mt-6">
          <Link href="/account/login" className="text-white/40 hover:text-white/60 text-[13px] transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
        <p className="text-white/60 text-[13px] leading-relaxed">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

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
            disabled={isSending}
            className="mt-2 w-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 text-white/80 placeholder:text-white/20 text-[14px] outline-none focus:border-[#E55125]/50 disabled:opacity-60"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="w-full inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
        >
          {isSending ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <div className="text-center mt-6">
        <Link href="/account/login" className="text-white/40 hover:text-white/60 text-[13px] transition-colors">
          ← Back to sign in
        </Link>
      </div>
    </>
  );
}

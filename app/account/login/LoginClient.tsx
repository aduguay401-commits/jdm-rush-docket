"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

function MailCheckIcon({ tone }: { tone: "success" | "error" }) {
  const isSuccess = tone === "success";
  const strokeClass = isSuccess ? "text-[#E55125]" : "text-amber-400";
  const boxClass = isSuccess
    ? "bg-[#E55125]/10 border-[#E55125]/25"
    : "bg-amber-400/10 border-amber-400/25";

  return (
    <div className={`w-12 h-12 border flex items-center justify-center shrink-0 ${boxClass}`}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
        {isSuccess ? <path d="m14.5 17 2 2 4-4" /> : <path d="M17 14v3M17 20h.01" />}
      </svg>
    </div>
  );
}

export function LoginClient({ nextPath, errorMessage }: { nextPath: string; errorMessage?: string | null }) {
  const [email, setEmail] = useState("");
  const [sentToEmail, setSentToEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(errorMessage ? "error" : "idle");
  const [message, setMessage] = useState(errorMessage ?? "");
  const [announcement, setAnnouncement] = useState("");
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "sent") {
      confirmationHeadingRef.current?.focus();
    }
  }, [status]);

  function announce(nextMessage: string) {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(nextMessage), 0);
  }

  const showIntro = status === "idle" || status === "sending";

  function resetForm() {
    setEmail(sentToEmail);
    setStatus("idle");
    setMessage("");
    setAnnouncement("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedEmail = email.trim();

    if (!submittedEmail) {
      const nextMessage = "Enter the email address for your JDM Rush account.";
      setStatus("error");
      setMessage(nextMessage);
      announce(nextMessage);
      return;
    }

    const sendingMessage = "Sending your secure login link...";
    setStatus("sending");
    setMessage(sendingMessage);
    announce(sendingMessage);

    const response = await fetch("/api/customer/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: submittedEmail, next: nextPath }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      const nextMessage = payload?.error ?? "Unable to send login link. Check the address and try again.";
      setStatus("error");
      setMessage(nextMessage);
      announce(nextMessage);
      return;
    }

    const successMessage = `Check your inbox. We sent a secure login link to ${submittedEmail}. Click it to open your garage.`;
    setSentToEmail(submittedEmail);
    setEmail("");
    setStatus("sent");
    setMessage(`We sent a secure login link to ${submittedEmail}.`);
    announce(successMessage);
  }

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {showIntro && (
        <p className="text-white/80 text-[14px] sm:text-[15px] font-semibold -mt-5 mb-8 leading-snug text-center">
          Enter your email and we will send a secure login link.
        </p>
      )}

      {status === "sent" ? (
        <div className="bg-black border border-[#E55125]/25 px-5 sm:px-6 py-6 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <MailCheckIcon tone="success" />
            <div className="min-w-0">
              <p
                className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
              >
                Link sent
              </p>
              <h2
                ref={confirmationHeadingRef}
                tabIndex={-1}
                className="text-white text-[20px] font-extrabold tracking-tight leading-snug outline-none"
              >
                Check your inbox
              </h2>
              <p className="text-white/60 text-[13px] leading-relaxed mt-2">
                We sent a secure login link to <span className="text-white font-semibold">{sentToEmail}</span> - click it to open your garage.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <p className="text-white/25 text-[11px] leading-relaxed">
              The link may take a minute to arrive. Check spam if it does not show up.
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="shrink-0 text-[#E55125] hover:brightness-110 text-[12px] font-medium transition-all text-left sm:text-right"
            >
              Use a different email / Resend
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
          <div>
            {status === "error" && message && (
              <div className="mb-4 border border-amber-400/25 bg-amber-400/[0.04] px-4 py-3 flex items-start gap-3">
                <MailCheckIcon tone="error" />
                <div className="min-w-0">
                  <p className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.12em] mb-1">
                    Link not sent
                  </p>
                  <p className="text-white/65 text-[13px] leading-relaxed">{message}</p>
                </div>
              </div>
            )}
            {status === "sending" && message && (
              <p className="mb-4 text-white/40 text-[12px] leading-relaxed">{message}</p>
            )}
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
              className="mt-2 w-full bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 text-white/80 placeholder:text-white/20 text-[14px] outline-none focus:border-[#E55125]/50"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full inline-flex items-center justify-center bg-[#E55125] hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all duration-150"
          >
            {status === "sending" ? "Sending..." : "Send secure login link"}
          </button>
        </form>
      )}
    </>
  );
}

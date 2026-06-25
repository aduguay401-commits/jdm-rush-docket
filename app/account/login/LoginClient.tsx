"use client";

import { FormEvent, useState } from "react";

export function LoginClient({ nextPath, errorMessage }: { nextPath: string; errorMessage?: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState(errorMessage ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const response = await fetch("/api/customer/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: nextPath }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setStatus("error");
      setMessage(payload?.error ?? "Unable to send login link.");
      return;
    }

    setStatus("sent");
    setMessage(payload?.message ?? "Check your email for a secure login link.");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
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

      {message && (
        <p className={status === "error" ? "text-amber-400/80 text-[12px] leading-relaxed" : "text-white/40 text-[12px] leading-relaxed"}>
          {message}
        </p>
      )}
    </form>
  );
}

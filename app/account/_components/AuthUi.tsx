"use client";

import { type ReactNode, useEffect, useRef } from "react";

export function GoogleIcon() {
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

export function OrDivider() {
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

export function MailCheckIcon({ tone }: { tone: "success" | "error" }) {
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
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
        {isSuccess ? <path d="m14.5 17 2 2 4-4" /> : <path d="M17 14v3M17 20h.01" />}
      </svg>
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="border border-amber-400/25 bg-amber-400/[0.04] px-4 py-3 text-amber-400 text-[13px]">
      {children}
    </div>
  );
}

export function SentStateCard({
  label,
  heading,
  body,
  footerHint,
  footerAction,
  cta,
}: {
  label: string;
  heading: string;
  body: ReactNode;
  footerHint?: string;
  footerAction?: ReactNode;
  cta?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="bg-black border border-[#E55125]/25 px-5 sm:px-6 py-6 flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <MailCheckIcon tone="success" />
        <div className="min-w-0">
          <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">{label}</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-white text-[20px] font-extrabold tracking-tight leading-snug outline-none"
          >
            {heading}
          </h2>
          <p className="text-white/60 text-[13px] leading-relaxed mt-2">{body}</p>
        </div>
      </div>

      {(footerHint || footerAction || cta) && (
        <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          {footerHint ? <p className="text-white/25 text-[11px] leading-relaxed">{footerHint}</p> : <span />}
          {footerAction}
          {cta}
        </div>
      )}
    </div>
  );
}

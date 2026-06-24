"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";

// ── Icons ──────────────────────────────────────────────────────────────────────

function LockIcon({ className = "text-white/[0.15]" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── Unlocked section card ─────────────────────────────────────────────────────

function UnlockedCard({
  num,
  label,
  sublabel,
  statusBadge,
  footer,
  href,
}: {
  num: string;
  label: string;
  sublabel: string;
  statusBadge?: string;
  footer?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-black border border-white/[0.08] hover:border-white/[0.18] transition-colors duration-200 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[#E55125]/50 text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.1em" }}
          >
            {num}
          </span>
          {statusBadge && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E55125]" />
              <span
                className="text-[#E55125] text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                {statusBadge}
              </span>
            </div>
          )}
        </div>
        <span className="text-white/25 hover:text-white/60 transition-colors shrink-0">
          <ChevronRight />
        </span>
      </div>
      <h2 className="text-white text-[17px] sm:text-[19px] font-extrabold tracking-tight mb-1.5">
        {label}
      </h2>
      <p className="text-white/40 text-[12px] leading-relaxed">{sublabel}</p>
      {footer && (
        <div className="mt-5 pt-4 border-t border-[#E55125]/10">
          <span className="text-white/30 text-[11px]">{footer}</span>
        </div>
      )}
    </Link>
  );
}

// ── Locked section card ───────────────────────────────────────────────────────

function LockedCard({
  num,
  label,
  sublabel,
  unlockHint,
}: {
  num: string;
  label: string;
  sublabel: string;
  unlockHint: string;
}) {
  return (
    <div className="bg-black/50 border border-white/[0.04] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span
          className="text-white/15 text-[11px] font-bold uppercase"
          style={{ letterSpacing: "0.1em" }}
        >
          {num}
        </span>
        <LockIcon />
      </div>
      <h2 className="text-white/35 text-[17px] sm:text-[19px] font-extrabold tracking-tight mb-1.5">
        {label}
      </h2>
      <p className="text-white/20 text-[12px] leading-relaxed">{sublabel}</p>
      <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center gap-2">
        <LockIcon className="text-white/[0.12] shrink-0" />
        <span className="text-white/20 text-[11px]">{unlockHint}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CarDashboard() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <PageHeader
        micro="1999 Nissan Skyline GT-R R34 · Your import is at the Research stage. Review your candidate reports."
        backHref="/account"
        backLabel="My Garage"
      />

      <main id="main-content">
        {/* Section cards */}
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-3">
          <UnlockedCard
            num="01"
            label="Research & Decision"
            sublabel="Q&A with your sourcing team · Candidate reports · Choose your car"
            statusBadge="Report ready · Action needed"
            footer="2 candidate cars sourced · 1 report ready"
            href="/account/research"
          />
          <LockedCard
            num="02"
            label="Purchase & Documents"
            sublabel="Sign agreement · Pay deposit · Document vault"
            unlockHint="Unlocks when you commit to a car"
          />
          <LockedCard
            num="03"
            label="Your JDM Journey"
            sublabel="Port to your driveway · 5-stage shipping tracker"
            unlockHint="Unlocks once deposit paid + agreement signed"
          />
        </div>
      </main>
    </div>
  );
}

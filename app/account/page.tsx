"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";

// ── Car photo placeholder ─────────────────────────────────────────────────────

function CarPhoto() {
  return (
    <div
      className="relative w-full overflow-hidden flex items-center justify-center bg-[#0a0a0a]"
      style={{ aspectRatio: "16/9" }}
    >
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,1) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,1) 32px)",
        }}
      />
      <svg
        width="64"
        height="40"
        viewBox="0 0 100 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/[0.07]"
      >
        <rect x="5" y="28" width="90" height="22" rx="3" />
        <path d="M20 28 L32 14 L68 14 L80 28" />
        <circle cx="24" cy="50" r="8" />
        <circle cx="76" cy="50" r="8" />
        <circle cx="24" cy="50" r="3" />
        <circle cx="76" cy="50" r="3" />
      </svg>
    </div>
  );
}

// ── 3-section progress hint ───────────────────────────────────────────────────

function ProgressHint({ label, active }: { label: string; active: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-3.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-[3px] w-5 ${
            i < active
              ? "bg-[#E55125]/40"
              : i === active
              ? "bg-[#E55125]"
              : "bg-white/[0.08]"
          }`}
        />
      ))}
      <span
        className="text-white/20 text-[10px] ml-1"
        style={{ letterSpacing: "0.06em" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Car card ──────────────────────────────────────────────────────────────────

type CarCardProps = {
  vehicle: string;
  statusLabel: string;
  statusColor: "orange" | "amber";
  activeSection: number;
  progressLabel: string;
  href: string;
};

function CarCard({
  vehicle,
  statusLabel,
  statusColor,
  activeSection,
  progressLabel,
  href,
}: CarCardProps) {
  const dotColor =
    statusColor === "orange" ? "bg-[#E55125]" : "bg-amber-400";
  const textColor =
    statusColor === "orange" ? "text-[#E55125]" : "text-amber-400";

  return (
    <Link
      href={href}
      className="block bg-black border border-white/[0.08] hover:border-white/[0.18] transition-colors duration-200"
    >
      <CarPhoto />
      <div className="px-5 py-4">
        {/* Status badge */}
        <div className="inline-flex items-center gap-1.5 mb-2.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
          <span
            className={`text-[10px] font-bold uppercase ${textColor}`}
            style={{ letterSpacing: "0.1em" }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Vehicle name */}
        <h2 className="text-white text-[15px] font-extrabold tracking-tight leading-snug">
          {vehicle}
        </h2>

        {/* Section progress hint */}
        <ProgressHint label={progressLabel} active={activeSection} />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyGarageHome() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <main id="main-content">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {/* Page heading */}
          <div className="mb-8 sm:mb-10">
            <p
              className="text-[#E55125]/70 text-[11px] font-bold uppercase mb-2"
              style={{ letterSpacing: "0.14em" }}
            >
              My Garage
            </p>
            <div className="w-8 h-[2px] bg-[#E55125] mb-5" />
            <h1 className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight">
              Your imports
            </h1>
          </div>

          {/* Car cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[900px]">
            <CarCard
              vehicle="1999 Nissan Skyline GT-R R34"
              statusLabel="Report ready — action needed"
              statusColor="orange"
              activeSection={1}
              progressLabel="Research stage"
              href="/account/car"
            />
            <CarCard
              vehicle="2002 Subaru Impreza WRX STI"
              statusLabel="At port, awaiting vessel"
              statusColor="amber"
              activeSection={3}
              progressLabel="Shipping tracker"
              href="/account/car"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

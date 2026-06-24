"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CANDIDATES = [
  {
    id: "opt-a",
    vehicle: "1999 Nissan Skyline GT-R R34 — Option A",
    grade: "4",
    mileage: "72,000 km",
    colour: "Midnight Purple",
    notes: "Clean carfax, matching numbers, full service history.",
  },
  {
    id: "opt-b",
    vehicle: "1999 Nissan Skyline GT-R R34 — Option B",
    grade: "3.5",
    mileage: "88,000 km",
    colour: "Bayside Blue",
    notes: "Minor rear panel repair noted in grade sheet. Priced lower.",
  },
];

// ── Candidate photo placeholder ────────────────────────────────────────────────

function CandidatePhoto() {
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
      {/* Report badge overlay */}
      <div className="absolute top-3 left-3">
        <span
          className="bg-black/70 border border-white/[0.10] text-white/30 text-[9px] font-bold uppercase px-2 py-1"
          style={{ letterSpacing: "0.08em" }}
        >
          Report Photo
        </span>
      </div>
      <svg
        width="64"
        height="40"
        viewBox="0 0 100 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/[0.06]"
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

// ── Arrow icon ─────────────────────────────────────────────────────────────────

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ── Candidate card ─────────────────────────────────────────────────────────────

function CandidateCard({ car }: { car: (typeof MOCK_CANDIDATES)[0] }) {
  return (
    <div className="bg-black border border-white/[0.08]">
      {/* Photo */}
      <CandidatePhoto />

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-white text-[15px] font-bold leading-snug">
            {car.vehicle}
          </h3>
          <span className="shrink-0 border border-white/[0.10] px-2 py-0.5 text-white/40 text-[10px] font-bold uppercase tracking-[0.08em]">
            Grade {car.grade}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3">
          <span className="text-white/35 text-[12px]">{car.mileage}</span>
          <span className="text-white/35 text-[12px]">{car.colour}</span>
        </div>
        <p className="text-white/30 text-[12px] leading-relaxed mb-5">{car.notes}</p>

        {/* Big chunky orange CTA */}
        <button
          type="button"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#E55125] hover:brightness-110 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all duration-150"
        >
          View Full Report
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <PageHeader
        micro="Research & Decision · Your sourcing team has found 2 candidates. Review the full reports below."
        backHref="/account/car"
        backLabel="1999 Nissan Skyline GT-R R34"
      />

      <main id="main-content">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
          {/* Candidates */}
          <div>
            <p
              className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em] mb-4"
            >
              Sourced Candidates
            </p>
            <div className="flex flex-col gap-4">
              {MOCK_CANDIDATES.map((car) => (
                <CandidateCard key={car.id} car={car} />
              ))}
            </div>
          </div>

          {/* Messages pointer — Q&A is in the global thread */}
          <div className="bg-black border border-white/[0.06] px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/50 text-[13px] font-medium">
                Questions from your sourcing team
              </p>
              <p className="text-white/25 text-[11px] mt-0.5">
                The conversation thread lives in Messages
              </p>
            </div>
            <Link
              href="/account/messages"
              className="shrink-0 inline-flex items-center gap-1.5 text-[#E55125] hover:brightness-110 text-[12px] font-medium transition-all"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Open Messages
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

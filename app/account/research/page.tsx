"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";

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

// ── SectionEyebrow ─────────────────────────────────────────────────────────────

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center mb-5">
      <p
        className="text-[#E55125]/70 text-[12px] font-bold uppercase mb-2"
        style={{ letterSpacing: "0.12em" }}
      >
        {label}
      </p>
      <div className="w-8 h-[2px] bg-[#E55125]" />
    </div>
  );
}

// ── Candidate card ─────────────────────────────────────────────────────────────

function CandidateCard({ car }: { car: (typeof MOCK_CANDIDATES)[0] }) {
  return (
    <div className="bg-black border border-white/[0.08] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-white text-[14px] font-bold leading-snug">
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
      <p className="text-white/30 text-[12px] leading-relaxed mb-4">{car.notes}</p>
      <button
        type="button"
        className="inline-flex items-center gap-2 border border-white/[0.12] text-white/50 hover:text-white hover:border-white/25 text-[12px] font-medium px-4 py-2 transition-colors"
      >
        View Full Report
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <main id="main-content">
        {/* Page title */}
        <section className="bg-black border-b border-white/[0.08] py-10 sm:py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto">
            <Link
              href="/account/car"
              className="inline-flex items-center gap-1.5 text-white/35 hover:text-white text-[12px] font-medium transition-colors mb-6"
            >
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
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              My Garage
            </Link>
            <SectionEyebrow label="My Garage · Section 01" />
            <h1 className="text-center text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
              Research &amp; Decision
            </h1>
            <p className="text-center text-white/40 text-[14px] max-w-sm mx-auto">
              1999 Nissan Skyline GT-R R34 · 2 candidates sourced
            </p>
          </div>
        </section>

        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
          {/* Candidates */}
          <div>
            <p
              className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em] mb-4"
            >
              Sourced Candidates
            </p>
            <div className="flex flex-col gap-3">
              {MOCK_CANDIDATES.map((car) => (
                <CandidateCard key={car.id} car={car} />
              ))}
            </div>
          </div>

          {/* Messages pointer — Q&A is now in the global thread */}
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

          {/* Decision CTA */}
          <div className="bg-black border border-[#E55125]/25 px-5 sm:px-6 py-6">
            <p
              className="text-[#E55125] text-[11px] font-bold uppercase tracking-[0.1em] mb-2"
            >
              Ready to commit?
            </p>
            <p className="text-white/50 text-[13px] leading-relaxed mb-5">
              Choose the car you want to import. Committing to a car unlocks{" "}
              <strong className="text-white/70">Purchase &amp; Documents</strong> — you&apos;ll
              sign the agreement and pay the deposit to hold it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#E55125] text-white text-[13px] font-bold tracking-wide px-6 py-3 transition-all duration-200 hover:brightness-110"
              >
                Choose Option A
              </button>
              <button
                type="button"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 border border-white/[0.12] text-white/50 hover:text-white hover:border-white/25 text-[13px] font-medium px-6 py-3 transition-colors"
              >
                Choose Option B
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

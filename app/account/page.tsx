"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";

// ── Mock: 2-car garage (switcher shown; hides automatically for 1 car) ────────

const MOCK_GARAGE = [
  { id: "r34", label: "1999 Nissan Skyline GT-R R34", active: true },
  { id: "wrx", label: "2002 Subaru Impreza WRX STI",  active: false },
];

// Mock state: car at stage 2 — report ready, decision pending
// Section 1 UNLOCKED (active), Sections 2 + 3 LOCKED

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function LockIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Garage switcher ────────────────────────────────────────────────────────────
// Hidden when garage has only 1 car — shown here for the multi-car concept.

function GarageSwitcher() {
  return (
    <div className="bg-black border-b border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-stretch gap-0 overflow-x-auto">
          <div className="flex items-center pr-3 mr-2 border-r border-white/[0.06] shrink-0">
            <span className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em]">
              Garage
            </span>
          </div>
          {MOCK_GARAGE.map((car) => (
            <button
              key={car.id}
              type="button"
              className={[
                "shrink-0 px-4 py-3.5 text-[12px] sm:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                car.active
                  ? "text-white border-[#E55125]"
                  : "text-white/30 border-transparent hover:text-white/55",
              ].join(" ")}
            >
              {car.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Right Now banner ───────────────────────────────────────────────────────────

function RightNowBanner() {
  return (
    <div className="bg-black border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex gap-4 sm:gap-5">
          <div className="w-[3px] bg-[#E55125] shrink-0 self-stretch rounded-full" />
          <div className="flex-1 min-w-0">
            <p
              className="text-[#E55125]/70 text-[10px] font-bold uppercase mb-2"
              style={{ letterSpacing: "0.15em" }}
            >
              Right Now
            </p>
            <p className="text-white text-[17px] sm:text-[19px] font-bold leading-snug mb-1.5">
              Your R34 options are researched and ready.
            </p>
            <p className="text-white/40 text-[13px] leading-relaxed mb-5">
              Read the report, compare the sourced candidates, and choose the
              car you want to import.
            </p>
            <Link
              href="/account/research"
              className="inline-flex items-center gap-2 bg-[#E55125] text-white text-[13px] font-bold tracking-wide px-5 py-2.5 transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_20px_rgba(229,81,37,0.3)]"
            >
              Review Report
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section cards ──────────────────────────────────────────────────────────────

function ResearchCard() {
  return (
    <Link
      href="/account/research"
      className="block bg-black border border-white/[0.08] p-5 sm:p-6 hover:border-white/[0.18] transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
            <span className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em]">
              01
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E55125] shrink-0" />
              <span className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.08em]">
                Report ready · action needed
              </span>
            </span>
          </div>
          <h2 className="text-white text-[17px] font-bold tracking-tight mb-1">
            Research &amp; Decision
          </h2>
          <p className="text-white/35 text-[12px] sm:text-[13px]">
            Q&amp;A with your sourcing team · Candidate reports · Choose your car
          </p>
        </div>
        <div className="text-white/25 group-hover:text-white/60 transition-colors mt-0.5 shrink-0">
          <ChevronRight />
        </div>
      </div>
      <div className="mt-4 pt-3.5 border-t border-[#E55125]/12 flex items-center gap-2">
        <span className="text-white/30 text-[12px]">
          2 candidate cars sourced · 1 report ready
        </span>
      </div>
    </Link>
  );
}

function PurchaseCard() {
  return (
    <div className="bg-black/50 border border-white/[0.04] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <span className="text-white/15 text-[10px] font-bold uppercase tracking-[0.12em]">
              02
            </span>
          </div>
          <h2 className="text-white/35 text-[17px] font-bold tracking-tight mb-1">
            Purchase &amp; Documents
          </h2>
          <p className="text-white/20 text-[12px] sm:text-[13px]">
            Sign agreement · Pay deposit · Document vault
          </p>
        </div>
        <div className="text-white/15 mt-0.5 shrink-0">
          <LockIcon />
        </div>
      </div>
      <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center gap-1.5 text-white/20">
        <LockIcon size={11} />
        <span className="text-[11px]">Unlocks when you commit to a car</span>
      </div>
    </div>
  );
}

function JourneyCard() {
  return (
    <div className="bg-black/50 border border-white/[0.04] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <span className="text-white/15 text-[10px] font-bold uppercase tracking-[0.12em]">
              03
            </span>
          </div>
          <h2 className="text-white/35 text-[17px] font-bold tracking-tight mb-1">
            Your JDM Journey
          </h2>
          <p className="text-white/20 text-[12px] sm:text-[13px]">
            Port to your driveway · 5-stage shipping tracker
          </p>
        </div>
        <div className="text-white/15 mt-0.5 shrink-0">
          <LockIcon />
        </div>
      </div>
      <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center gap-1.5 text-white/20">
        <LockIcon size={11} />
        <span className="text-[11px]">
          Unlocks once deposit paid + agreement signed
        </span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CustomerAccountPage() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />
      <GarageSwitcher />
      <RightNowBanner />

      <main id="main-content">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p
            className="text-white/25 text-[10px] font-bold uppercase mb-5"
            style={{ letterSpacing: "0.12em" }}
          >
            My Garage · 1999 Nissan Skyline GT-R R34
          </p>
          <div className="flex flex-col gap-3">
            <ResearchCard />
            <PurchaseCard />
            <JourneyCard />
          </div>
        </div>
      </main>
    </div>
  );
}

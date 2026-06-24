"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";

// ── Journey stages ────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { id: 1, label: "Purchased",                short: "Purchased" },
  { id: 2, label: "At port, awaiting vessel", short: "At Port"   },
  { id: 3, label: "On the vessel",            short: "On Vessel" },
  { id: 4, label: "Customs & landing",        short: "Customs"   },
  { id: 5, label: "Delivered",                short: "Delivered" },
] as const;

const CURRENT_STEP = 2;
const MOCK_VEHICLE = "1999 Nissan Skyline GT-R R34";
const LAST_UPDATE = "June 20, 2026";

// ── Stepper ───────────────────────────────────────────────────────────────────

function JourneyStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full py-5" aria-label={`Step ${currentStep} of ${JOURNEY_STEPS.length}`}>
      <div className="grid grid-cols-5">
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent   = step.id === currentStep;
          const isFirst     = index === 0;
          const isLast      = index === JOURNEY_STEPS.length - 1;

          return (
            <div key={step.id} className="flex flex-col items-center min-w-0">
              <div className="flex w-full items-center">
                <div className={`h-[2px] flex-1 ${isFirst ? "bg-transparent" : isCompleted || isCurrent ? "bg-[#E55125]" : "bg-white/[0.10]"}`} />
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  title={step.label}
                  className={[
                    "shrink-0 rounded-full transition-all",
                    isCurrent
                      ? "w-4 h-4 bg-[#E55125] ring-[3px] ring-[#E55125]/20 ring-offset-2 ring-offset-black"
                      : isCompleted
                      ? "w-3 h-3 bg-[#E55125]"
                      : "w-3 h-3 border border-white/20 bg-transparent",
                  ].join(" ")}
                />
                <div className={`h-[2px] flex-1 ${isLast ? "bg-transparent" : isCompleted ? "bg-[#E55125]" : "bg-white/[0.10]"}`} />
              </div>
              <p
                title={step.label}
                className={[
                  "mt-2 text-center leading-none text-[10px] sm:text-[12px] font-medium truncate w-full px-1",
                  isCurrent ? "text-white" : isCompleted ? "text-[#E55125]/60" : "text-white/20",
                ].join(" ")}
              >
                {step.short}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stage callouts ────────────────────────────────────────────────────────────

const STAGE_CALLOUTS: Record<number, { title: string; body: string; type: "action" | "reassure" | "neutral" | "done" }> = {
  1: {
    title: "Purchase confirmed",
    body: "Your car has been purchased. Your sourcing team is now coordinating export from Japan. You'll be notified when it's at the port.",
    type: "neutral",
  },
  2: {
    title: "Your R34 is at the port — this is the longest wait",
    body: "Your car is in Japan at the port waiting to be loaded onto the next available vessel. This typically takes 4–8 weeks and is completely normal. No action needed — we'll notify you the moment it sets sail.",
    type: "reassure",
  },
  3: {
    title: "Your car is on the water",
    body: "Your R34 has been loaded and is currently crossing the Pacific. Transit to Canada typically takes 3–5 weeks. Sit tight — we'll update you when it arrives at the Canadian port.",
    type: "neutral",
  },
  4: {
    title: "Customs and landing",
    body: "Your car has arrived in Canada and is going through customs clearance. This usually takes 5–10 business days. Your broker is on it.",
    type: "neutral",
  },
  5: {
    title: "Delivered",
    body: "Your R34 has been delivered. Welcome to JDM ownership. All your documents remain accessible in the vault.",
    type: "done",
  },
};

function StageCallout({ step }: { step: number }) {
  const callout = STAGE_CALLOUTS[step];
  if (!callout) return null;

  const wrapClass =
    callout.type === "reassure"
      ? "border-amber-400/20 bg-amber-400/[0.04]"
      : callout.type === "done"
      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
      : "border-white/[0.08] bg-white/[0.025]";

  const labelClass =
    callout.type === "reassure"
      ? "text-amber-400"
      : callout.type === "done"
      ? "text-emerald-400"
      : "text-white/60";

  return (
    <div className={`border px-5 py-5 ${wrapClass}`}>
      {callout.type === "reassure" && (
        <div className="flex items-center gap-2 mb-3">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/70 shrink-0">
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="22" x2="12" y2="8" />
            <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
          </svg>
          <span className="text-amber-400/60 text-[10px] font-bold uppercase tracking-[0.12em]">
            Normal — longest stage
          </span>
        </div>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-[0.08em] mb-2 ${labelClass}`}>
        {callout.title}
      </p>
      <p className="text-white/45 text-[13px] leading-relaxed">
        {callout.body}
      </p>
    </div>
  );
}

// ── Timeline detail ────────────────────────────────────────────────────────────

function StageTimeline() {
  return (
    <div className="mt-8">
      <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em] mb-4">
        Full Journey
      </p>
      <div className="flex flex-col">
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = step.id < CURRENT_STEP;
          const isCurrent   = step.id === CURRENT_STEP;
          const isLast      = index === JOURNEY_STEPS.length - 1;

          return (
            <div key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center shrink-0 w-5">
                <div className={[
                  "rounded-full shrink-0",
                  isCurrent ? "w-3.5 h-3.5 bg-[#E55125] ring-2 ring-[#E55125]/20 ring-offset-1 ring-offset-[#111]" : "",
                  isCompleted ? "w-2.5 h-2.5 bg-[#E55125]" : "",
                  !isCurrent && !isCompleted ? "w-2.5 h-2.5 border border-white/20" : "",
                ].join(" ")} />
                {!isLast && (
                  <div className={`w-[2px] flex-1 mt-1.5 mb-1.5 ${isCompleted ? "bg-[#E55125]/50" : "bg-white/[0.06]"}`} />
                )}
              </div>

              <div className={`pb-5 ${isLast ? "" : ""}`}>
                <p className={`text-[13px] font-semibold leading-snug ${isCurrent ? "text-white" : isCompleted ? "text-[#E55125]/60" : "text-white/25"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-amber-400/70 text-[11px] mt-0.5">
                    In progress · Last updated {LAST_UPDATE}
                  </p>
                )}
                {isCompleted && step.id === 1 && (
                  <p className="text-white/25 text-[11px] mt-0.5">Jun 2, 2026</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const currentStepObj = JOURNEY_STEPS[CURRENT_STEP - 1];

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <PageHeader
        micro="Your JDM Journey · Your R34 is at port in Japan. Track each stage from Japan to your driveway."
        backHref="/account/car"
        backLabel="1999 Nissan Skyline GT-R R34"
      />

      <main id="main-content">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-10">

          {/* Stepper card */}
          <div className="bg-black border border-white/[0.08] px-5 sm:px-8 pt-5 pb-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.1em]">
                Now: {currentStepObj?.label}
              </p>
              <span className="text-white/25 text-[10px] font-medium">
                Step {CURRENT_STEP}/{JOURNEY_STEPS.length}
              </span>
            </div>
            <JourneyStepper currentStep={CURRENT_STEP} />
          </div>

          {/* Stage callout */}
          <StageCallout step={CURRENT_STEP} />

          {/* Full timeline */}
          <div className="mt-6 bg-black border border-white/[0.08] px-5 sm:px-6 py-5">
            <StageTimeline />
          </div>
        </div>
      </main>
    </div>
  );
}

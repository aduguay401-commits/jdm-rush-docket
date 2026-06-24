"use client";

import { getCustomerReportUrl } from "@/lib/urls";

// ── Journey spine ─────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { id: 1, label: "Request received",        short: "Requested" },
  { id: 2, label: "Sourcing & research",      short: "Research"  },
  { id: 3, label: "Reserved",                 short: "Reserved"  },
  { id: 4, label: "Purchased",                short: "Purchased" },
  { id: 5, label: "At port, awaiting vessel", short: "At Port"   },
  { id: 6, label: "On the vessel",            short: "On Vessel" },
  { id: 7, label: "Customs & landing",        short: "Customs"   },
  { id: 8, label: "Delivered",                short: "Delivered" },
] as const;

// ── Mock data (Coder replaces with real Supabase + RLS query after design-lock) ─

type MockCar = {
  id: string;
  vehicle: string;
  currentStep: number;
  reportToken?: string;
  submittedAt: string;
  callout: {
    title: string;
    body: string;
    needsAction?: boolean;
    reassure?: boolean;
  };
};

const MOCK_CARS: MockCar[] = [
  {
    id: "car-1",
    vehicle: "2002 Subaru Impreza WRX STI",
    currentStep: 2,
    reportToken: "mock-token-wrx",
    submittedAt: "June 10, 2026",
    callout: {
      title: "Your import report is ready",
      body: "We've completed research on your WRX STI — full landed-cost breakdown and two auction listings worth watching. Review the report and let us know if you'd like to move forward.",
      needsAction: true,
    },
  },
  {
    id: "car-2",
    vehicle: "1999 Nissan Skyline GT-R R34",
    currentStep: 5,
    reportToken: "mock-token-r34",
    submittedAt: "May 2, 2026",
    callout: {
      title: "Your R34 is at the port — this is the longest wait",
      body: "Your car is in Japan at the port waiting to be loaded onto the next available vessel. This typically takes 4–8 weeks and is completely normal. No action needed — we'll notify you the moment it sets sail.",
      reassure: true,
    },
  },
  {
    id: "car-3",
    vehicle: "1997 Toyota Supra RZ",
    currentStep: 1,
    submittedAt: "June 18, 2026",
    callout: {
      title: "Request received — we're on it",
      body: "We've received your request. Our team is reviewing your requirements and will be in touch within 2 business days with sourcing options.",
    },
  },
];

const MOCK_CUSTOMER_NAME = "Sarah";

// ── Stepper ───────────────────────────────────────────────────────────────────

function JourneyStepper({ currentStep }: { currentStep: number }) {
  return (
    <div
      className="w-full py-4"
      aria-label={`Step ${currentStep} of ${JOURNEY_STEPS.length}`}
    >
      <div className="grid grid-cols-8">
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isFirst = index === 0;
          const isLast = index === JOURNEY_STEPS.length - 1;

          return (
            <div key={step.id} className="flex flex-col items-center min-w-0">
              {/* Connector + dot row */}
              <div className="flex w-full items-center">
                <div
                  className={`h-[2px] flex-1 ${
                    isFirst
                      ? "bg-transparent"
                      : isCompleted || isCurrent
                      ? "bg-[#E55125]"
                      : "bg-white/[0.10]"
                  }`}
                />
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  title={step.label}
                  className={[
                    "shrink-0 rounded-full transition-all duration-300",
                    isCurrent
                      ? "h-3.5 w-3.5 bg-[#E55125] ring-2 ring-[#E55125]/20 ring-offset-1 ring-offset-black"
                      : isCompleted
                      ? "h-2.5 w-2.5 bg-[#E55125]"
                      : "h-2.5 w-2.5 border border-white/20 bg-transparent",
                  ].join(" ")}
                />
                <div
                  className={`h-[2px] flex-1 ${
                    isLast
                      ? "bg-transparent"
                      : isCompleted
                      ? "bg-[#E55125]"
                      : "bg-white/[0.10]"
                  }`}
                />
              </div>
              {/* Label */}
              <p
                title={step.label}
                className={[
                  "mt-2 text-center leading-none truncate w-full px-[2px]",
                  "text-[8px] sm:text-[10px] font-medium",
                  isCurrent
                    ? "text-white"
                    : isCompleted
                    ? "text-[#E55125]/60"
                    : "text-white/20",
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

// ── What's next callout ───────────────────────────────────────────────────────

function JourneyCallout({
  callout,
  reportToken,
}: {
  callout: MockCar["callout"];
  reportToken?: string;
}) {
  const wrapClass = callout.needsAction
    ? "border-[#E55125]/30 bg-[#E55125]/[0.06]"
    : callout.reassure
    ? "border-amber-400/20 bg-amber-400/[0.04]"
    : "border-white/[0.08] bg-white/[0.025]";

  const titleClass = callout.needsAction
    ? "text-[#E55125]"
    : callout.reassure
    ? "text-amber-400"
    : "text-white/70";

  const reportUrl = reportToken ? getCustomerReportUrl(reportToken) : null;

  return (
    <div className={`border px-4 py-4 ${wrapClass}`}>
      {callout.reassure && (
        <div className="flex items-center gap-2 mb-2">
          {/* Anchor icon = waiting / port */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400/70 shrink-0"
          >
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="22" x2="12" y2="8" />
            <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
          </svg>
          <span className="text-amber-400/60 text-[10px] font-bold uppercase tracking-[0.1em]">
            Normal — longest stage
          </span>
        </div>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5 ${titleClass}`}>
        {callout.title}
      </p>
      <p className="text-white/45 text-[12px] sm:text-[13px] leading-relaxed">
        {callout.body}
      </p>
      {reportUrl && callout.needsAction && (
        <div className="mt-4">
          <a
            href={reportUrl}
            className="inline-flex items-center gap-2 bg-[#E55125] text-white text-[13px] font-bold tracking-wide px-5 py-2.5 transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_20px_rgba(229,81,37,0.3)]"
          >
            View Report
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
          </a>
        </div>
      )}
    </div>
  );
}

// ── Car journey card ──────────────────────────────────────────────────────────

function CarJourneyCard({ car }: { car: MockCar }) {
  const currentStepObj = JOURNEY_STEPS[car.currentStep - 1];
  const currentStepLabel = currentStepObj?.label ?? "";

  const accentColor = car.callout.needsAction
    ? "#E55125"
    : car.callout.reassure
    ? "rgba(251,191,36,0.4)"
    : car.currentStep === JOURNEY_STEPS.length
    ? "#22c55e"
    : "rgba(255,255,255,0.07)";

  return (
    <article className="bg-black border border-white/[0.08]">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-white text-[17px] font-bold tracking-tight leading-snug">
            {car.vehicle}
          </h2>
          <p className="text-white/25 text-[11px] mt-0.5">
            Submitted {car.submittedAt}
          </p>
        </div>
        <span className="shrink-0 border border-white/[0.10] px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] uppercase text-white/35 whitespace-nowrap mt-0.5">
          Step {car.currentStep}/8
        </span>
      </div>

      {/* Stepper */}
      <div className="px-4 sm:px-5">
        <JourneyStepper currentStep={car.currentStep} />
      </div>

      {/* Current stage label */}
      <div className="px-5 pb-3">
        <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.1em]">
          Now: {currentStepLabel}
        </p>
      </div>

      {/* Callout */}
      <div className="px-5 pb-5">
        <JourneyCallout callout={car.callout} reportToken={car.reportToken} />
      </div>

      {/* Bottom accent line */}
      <div className="h-[2px]" style={{ background: accentColor }} />
    </article>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="border border-dashed border-white/[0.12] bg-white/[0.02] px-8 py-16 text-center">
      <div className="flex justify-center mb-5">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/20"
        >
          <rect x="3" y="3" width="18" height="18" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <p className="text-white/60 text-[15px] font-medium mb-1">
        Your garage is empty
      </p>
      <p className="text-white/30 text-[13px] mb-6 max-w-xs mx-auto">
        Start your JDM journey. Tell us what you&apos;re looking for and we&apos;ll
        source it from Japan.
      </p>
      <a
        href="https://jdmrushimports.ca/find-my-jdm"
        className="inline-flex items-center gap-2 bg-[#E55125] text-white text-[13px] font-bold tracking-wide px-6 py-3 transition-all duration-200 hover:brightness-110"
      >
        Find My JDM
      </a>
    </div>
  );
}

// ── Section eyebrow ───────────────────────────────────────────────────────────

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center mb-6">
      <p
        className="text-[#E55125]/70 text-[13px] font-bold uppercase mb-2"
        style={{ letterSpacing: "0.12em" }}
      >
        {label}
      </p>
      <div className="w-10 h-[2px] bg-[#E55125]" />
    </div>
  );
}

// ── Account header ────────────────────────────────────────────────────────────

function AccountHeader({ customerName }: { customerName: string }) {
  return (
    <header className="sticky top-0 z-50 bg-black border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="https://jdmrushimports.ca" aria-label="JDM Rush Imports home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
              alt="JDM Rush Imports"
              height={32}
              style={{ height: "32px", width: "auto", display: "block" }}
            />
          </a>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#E55125]/20 border border-[#E55125]/40 flex items-center justify-center shrink-0">
                <span className="text-[#E55125] text-[13px] font-bold uppercase">
                  {customerName.charAt(0)}
                </span>
              </div>
              <span className="hidden sm:block text-white/70 text-[13px] font-medium">
                {customerName}
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/[0.12]" />
            <button
              type="button"
              className="text-white/50 hover:text-white text-[13px] font-medium transition-colors duration-200"
              onClick={() => {
                /* Coder wires Supabase signOut + redirect */
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomerAccountPage() {
  const hasCars = MOCK_CARS.length > 0;

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={MOCK_CUSTOMER_NAME} />

      <main id="main-content">
        {/* Hero */}
        <section className="bg-black border-b border-white/[0.08] py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto text-center">
            <SectionEyebrow label="My Garage" />
            <h1 className="text-white text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
              Your JDM Journey
            </h1>
            <p className="text-white/50 text-[15px] max-w-md mx-auto leading-relaxed">
              Track every step of your import from Japan to your driveway.
            </p>
          </div>
        </section>

        {/* Car list */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {hasCars ? (
            <>
              <p
                className="text-white/30 text-[11px] uppercase font-medium mb-6"
                style={{ letterSpacing: "0.09em" }}
              >
                {MOCK_CARS.length} {MOCK_CARS.length === 1 ? "car" : "cars"} in
                your garage
              </p>
              <div className="flex flex-col gap-4">
                {MOCK_CARS.map((car) => (
                  <CarJourneyCard key={car.id} car={car} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
    </div>
  );
}

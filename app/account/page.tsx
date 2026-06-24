"use client";


import { getCustomerReportUrl } from "@/lib/urls";

// ── Mock data (Coder replaces with real Supabase + RLS query after design-lock) ─

type MockDocket = {
  id: string;
  vehicle: string;
  status: "report_sent" | "research_in_progress" | "new";
  report_token: string;
  submitted_at: string;
};

const MOCK_DOCKETS: MockDocket[] = [
  {
    id: "mock-1",
    vehicle: "2002 Subaru Impreza WRX STI",
    status: "report_sent",
    report_token: "mock-token-abc123",
    submitted_at: "June 10, 2026",
  },
  {
    id: "mock-2",
    vehicle: "1999 Nissan Skyline GT-R R34",
    status: "research_in_progress",
    report_token: "mock-token-def456",
    submitted_at: "June 18, 2026",
  },
];

const MOCK_CUSTOMER_NAME = "Sarah";

// ── Status badge ────────────────────────────────────────────────────────────

type DocketStatus = MockDocket["status"];

const STATUS_CONFIG: Record<
  DocketStatus,
  { label: string; className: string }
> = {
  report_sent: {
    label: "REPORT READY",
    className:
      "bg-[#E55125] text-white text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 uppercase",
  },
  research_in_progress: {
    label: "IN PROGRESS",
    className:
      "border border-amber-400/30 bg-amber-400/10 text-amber-400 text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 uppercase",
  },
  new: {
    label: "NEW",
    className:
      "border border-white/20 bg-white/5 text-white/50 text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 uppercase",
  },
};

function StatusBadge({ status }: { status: DocketStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={cfg.className}>{cfg.label}</span>;
}

// ── Docket card ─────────────────────────────────────────────────────────────

function DocketCard({ docket }: { docket: MockDocket }) {
  const reportUrl = getCustomerReportUrl(docket.report_token);
  const canViewReport = docket.status === "report_sent";

  return (
    <article className="bg-black border border-white/[0.08]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <StatusBadge status={docket.status} />
          <span className="text-white/30 text-[11px] tracking-wide shrink-0">
            {docket.submitted_at}
          </span>
        </div>

        <h2 className="text-white text-lg font-bold tracking-tight leading-snug mb-1">
          {docket.vehicle}
        </h2>

        <p className="text-white/40 text-[13px] mb-5">
          {docket.status === "report_sent"
            ? "Your import report is ready to review."
            : docket.status === "research_in_progress"
            ? "Our team is researching your vehicle."
            : "We've received your request and will be in touch."}
        </p>

        {canViewReport ? (
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
        ) : (
          <span className="inline-flex items-center gap-2 border border-white/10 text-white/30 text-[13px] font-bold tracking-wide px-5 py-2.5 cursor-not-allowed">
            Report Pending
          </span>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="h-[2px]"
        style={{
          background:
            docket.status === "report_sent"
              ? "#E55125"
              : docket.status === "research_in_progress"
              ? "rgba(251,191,36,0.5)"
              : "rgba(255,255,255,0.08)",
        }}
      />
    </article>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

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
          <rect x="3" y="3" width="18" height="18" rx="0" />
          <path d="M9 9h6M9 13h4" />
        </svg>
      </div>
      <p className="text-white/60 text-[15px] font-medium mb-1">
        No dockets yet
      </p>
      <p className="text-white/30 text-[13px] mb-6 max-w-xs mx-auto">
        Submit a Find My JDM request to get started. Your import dockets will
        appear here.
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

// ── Section eyebrow ──────────────────────────────────────────────────────────

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

// ── Account header ───────────────────────────────────────────────────────────

function AccountHeader({ customerName }: { customerName: string }) {
  return (
    <header className="sticky top-0 z-50 bg-black border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="https://jdmrushimports.ca" aria-label="JDM Rush Imports home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
              alt="JDM Rush Imports"
              height={32}
              style={{ height: "32px", width: "auto", display: "block" }}
            />
          </a>

          {/* Right: logged-in state */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Avatar + name */}
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

            {/* Divider */}
            <div className="hidden sm:block w-px h-4 bg-white/[0.12]" />

            {/* Sign Out */}
            <button
              type="button"
              className="text-white/50 hover:text-white text-[13px] font-medium transition-colors duration-200"
              onClick={() => {
                /* Coder wires Supabase signOut + redirect to /agent/login */
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function CustomerAccountPage() {
  const hasDockets = MOCK_DOCKETS.length > 0;

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={MOCK_CUSTOMER_NAME} />

      <main id="main-content">
        {/* Page title section */}
        <section className="bg-black border-b border-white/[0.08] py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto text-center">
            <SectionEyebrow label="My Account" />
            <h1
              className="text-white text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3"
            >
              Your Dockets
            </h1>
            <p className="text-white/50 text-[15px] max-w-md mx-auto leading-relaxed">
              Track the status of your vehicle searches and access your import
              reports when they&apos;re ready.
            </p>
          </div>
        </section>

        {/* Docket list */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {hasDockets ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-white/40 text-[13px] tracking-wide uppercase font-medium" style={{ letterSpacing: "0.08em" }}>
                  {MOCK_DOCKETS.length} active{" "}
                  {MOCK_DOCKETS.length === 1 ? "docket" : "dockets"}
                </p>
              </div>
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                {MOCK_DOCKETS.map((docket) => (
                  <DocketCard key={docket.id} docket={docket} />
                ))}
              </div>

              {/* Bridge note for Adam / design review — visible in skeleton, removed after design-lock */}
              <div className="mt-8 border border-[#E55125]/20 bg-[#E55125]/5 px-5 py-4">
                <p className="text-[#E55125]/80 text-[12px] font-bold uppercase tracking-wide mb-1">
                  Design Bridge Note (remove before code-ready)
                </p>
                <p className="text-white/50 text-[12px] leading-relaxed">
                  &ldquo;View Report&rdquo; links open existing ReportClient pages (Outfit font,
                  #0d0d0d bg, rounded-xl cards). This dashboard is Manrope + #111 +
                  rounded-none. The transition is dark-to-dark and the #E55125 accent
                  carries through — acceptable. Recommend updating ReportClient font to
                  Manrope in a later phase; no blocking clash at this stage.
                </p>
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

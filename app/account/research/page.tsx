import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";
import {
  getCustomerPortalContext,
  getDocketHref,
  getDocketIdParam,
  getResearchData,
  getVehicleLabel,
  type AuctionEstimate,
  type AuctionResearch,
  type PrivateDealerOption,
} from "@/lib/customer/dashboard";

// ── Candidate data ────────────────────────────────────────────────────────────

type Candidate = {
  id: string;
  vehicle: string;
  grade: string;
  mileage: string;
  colour: string;
  notes: string;
};

function formatCad(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildDealerCandidate(option: PrivateDealerOption): Candidate {
  const vehicle = [option.year, option.make, option.model]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const delivered = formatCad(option.total_delivered_cad ?? option.dealer_price_cad);

  return {
    id: option.id,
    vehicle: `${vehicle || "Dealer option"}${option.option_number ? ` — Option ${option.option_number}` : ""}`,
    grade: option.grade?.trim() || "TBD",
    mileage: option.mileage?.trim() || "Mileage TBD",
    colour: option.colour?.trim() || "Colour TBD",
    notes: option.marcus_notes?.trim() || (delivered ? `Estimated delivered price: ${delivered}.` : "Full details are available in the report."),
  };
}

function buildAuctionCandidate(research: AuctionResearch, estimate: AuctionEstimate | null, fallbackVehicle: string): Candidate {
  const delivered = formatCad(estimate?.total_delivered_estimate_cad);
  const bid = typeof research.recommended_max_bid_jpy === "number"
    ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(research.recommended_max_bid_jpy)
    : null;

  return {
    id: research.id,
    vehicle: `${fallbackVehicle} — Auction research`,
    grade: "Auction",
    mileage: bid ? `Max bid ${bid}` : "Auction estimate",
    colour: delivered ? `Est. ${delivered}` : "Live auction market",
    notes: research.sales_history_notes?.trim() || "Auction market research is ready in your full report.",
  };
}

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

function CandidateCard({ car, reportHref }: { car: Candidate; reportHref: string | null }) {
  const ctaClass = "w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#E55125] hover:brightness-110 text-white text-[14px] font-bold tracking-wide px-7 py-3.5 transition-all duration-150";

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

        {reportHref ? (
          <Link href={reportHref} className={ctaClass}>
            View Full Report
            <ArrowRight />
          </Link>
        ) : (
          <button type="button" disabled className={`${ctaClass} opacity-50 hover:brightness-100 cursor-not-allowed`}>
            Report Pending
            <ArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyResearch() {
  return (
    <div className="bg-black border border-white/[0.08] px-5 py-6">
      <p className="text-white text-[15px] font-bold leading-snug">Research is in progress</p>
      <p className="text-white/30 text-[12px] leading-relaxed mt-2">
        Your sourcing team is still preparing candidate options. They will appear here as soon as they are ready.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  const context = await getCustomerPortalContext({
    nextPath: selectedDocketId ? `/account/research?docket=${encodeURIComponent(selectedDocketId)}` : "/account/research",
    selectedDocketId,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const research = await getResearchData(docket.id);
  const candidates = [
    ...research.dealerOptions.map(buildDealerCandidate),
    ...(research.auctionResearch ? [buildAuctionCandidate(research.auctionResearch, research.auctionEstimate, vehicle)] : []),
  ];
  const reportHref = docket.report_url_token ? `/report/${encodeURIComponent(docket.report_url_token)}` : null;
  const messagesHref = getDocketHref("/account/messages", docket.id);

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <PageHeader
        micro={`Research & Decision · Your sourcing team has found ${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}. Review the full reports below.`}
        backHref={getDocketHref("/account/car", docket.id)}
        backLabel={vehicle}
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
              {candidates.length > 0 ? (
                candidates.map((car) => <CandidateCard key={car.id} car={car} reportHref={reportHref} />)
              ) : (
                <EmptyResearch />
              )}
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
              href={messagesHref}
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

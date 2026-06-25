import type { ReactNode } from "react";
import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";
import {
  getCustomerPortalContext,
  getDocketHref,
  getDocketIdParam,
  getResearchData,
  getVehicleLabel,
  isPurchaseUnlocked,
  isShippingUnlocked,
} from "@/lib/customer/dashboard";

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

// ── Journey progress spine ────────────────────────────────────────────────────

type NodeStatus = "active" | "upcoming";

function SpineNode({ status }: { status: NodeStatus }) {
  if (status === "active") {
    return (
      <div
        aria-label="Current step"
        className="w-4 h-4 rounded-full bg-[#E55125] ring-[3px] ring-[#E55125]/25 ring-offset-[3px] ring-offset-[#111111]"
      />
    );
  }
  return (
    <div className="w-4 h-4 rounded-full border border-white/[0.15] bg-[#111111]" />
  );
}

function SpineConnector() {
  return (
    <div className="mt-3 flex-1 relative flex justify-center min-h-[48px]">
      <div className="absolute inset-y-0 w-px bg-white/[0.08]" />
      <div className="absolute inset-0 flex flex-col items-center justify-around py-3">
        {[0, 1, 2].map((i) => (
          <svg key={i} width="7" height="4" viewBox="0 0 7 4" fill="none" aria-hidden>
            <path
              d="M0.5 0.5L3.5 3.5L6.5 0.5"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

type SpineStep = { status: NodeStatus; card: ReactNode };

function JourneySpine({ steps }: { steps: SpineStep[] }) {
  return (
    <div className="relative flex flex-col gap-3">
      <div
        className="pointer-events-none absolute left-5 sm:left-6 top-0 bottom-0 w-px bg-white/[0.08]"
        aria-hidden
      />

      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="relative flex items-stretch gap-4">
            <div className="w-10 sm:w-12 shrink-0 bg-[#111111] flex flex-col items-center relative z-10">
              <div className="h-5 shrink-0" />
              <SpineNode status={step.status} />
              {!isLast && <SpineConnector />}
            </div>
            <div className="flex-1 min-w-0">{step.card}</div>
          </div>
        );
      })}
    </div>
  );
}

function buildResearchFooter(candidateCount: number, hasReport: boolean) {
  const candidateText = `${candidateCount} candidate ${candidateCount === 1 ? "car" : "cars"} sourced`;
  return hasReport ? `${candidateText} · report ready` : candidateText;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CarDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  const context = await getCustomerPortalContext({
    nextPath: selectedDocketId ? `/account/car?docket=${encodeURIComponent(selectedDocketId)}` : "/account/car",
    selectedDocketId,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const research = await getResearchData(docket.id);
  const candidateCount = research.dealerOptions.length + (research.auctionResearch ? 1 : 0);
  const purchaseUnlocked = isPurchaseUnlocked(docket);
  const shippingUnlocked = isShippingUnlocked(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <PageHeader
        micro={`${vehicle} · Your import is at the Research stage. Review your candidate reports.`}
        backHref="/account"
        backLabel="My JDM Garage"
      />

      <main id="main-content">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p
            className="text-white/25 text-[10px] font-bold uppercase mb-5"
            style={{ letterSpacing: "0.12em" }}
          >
            Your Journey
          </p>

          <JourneySpine
            steps={[
              {
                status: "active",
                card: (
                  <UnlockedCard
                    num="01"
                    label="Research & Decision"
                    sublabel="Q&A with your sourcing team · Candidate reports · Choose your car"
                    statusBadge={docket.status === "report_sent" ? "Report ready · Action needed" : "Research active"}
                    footer={buildResearchFooter(candidateCount, Boolean(docket.report_url_token))}
                    href={getDocketHref("/account/research", docket.id)}
                  />
                ),
              },
              {
                status: purchaseUnlocked ? "active" : "upcoming",
                card: purchaseUnlocked ? (
                  <UnlockedCard
                    num="02"
                    label="Purchase & Documents"
                    sublabel="Sign agreement · Pay deposit · Document vault"
                    statusBadge={docket.agreement_signed ? "Agreement signed" : "Action pending"}
                    footer={docket.deposit_paid ? "Deposit recorded" : "Deposit not yet recorded"}
                    href={getDocketHref("/account/documents", docket.id)}
                  />
                ) : (
                  <LockedCard
                    num="02"
                    label="Purchase & Documents"
                    sublabel="Sign agreement · Pay deposit · Document vault"
                    unlockHint="Unlocks when you commit to a car"
                  />
                ),
              },
              {
                status: shippingUnlocked ? "active" : "upcoming",
                card: shippingUnlocked ? (
                  <UnlockedCard
                    num="03"
                    label="Your JDM Journey"
                    sublabel="Port to your driveway · 5-stage shipping tracker"
                    statusBadge="Pending shipment setup"
                    footer="Detailed shipment tracking unlocks in Phase 3"
                    href={getDocketHref("/account/journey", docket.id)}
                  />
                ) : (
                  <LockedCard
                    num="03"
                    label="Your JDM Journey"
                    sublabel="Port to your driveway · 5-stage shipping tracker"
                    unlockHint="Unlocks once deposit paid + agreement signed"
                  />
                ),
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

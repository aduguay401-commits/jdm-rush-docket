import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";
import {
  getCardStatus,
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

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
  docket: CustomerDocket;
};

function CarCard({ docket }: CarCardProps) {
  const vehicle = getVehicleLabel(docket);
  const { statusLabel, statusColor, activeSection, progressLabel } = getCardStatus(docket);
  const href = getDocketHref("/account/car", docket.id);
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

function EmptyGarage() {
  return (
    <div className="bg-black border border-white/[0.08] px-5 py-8 max-w-[640px]">
      <p className="text-white text-[15px] font-extrabold tracking-tight leading-snug">
        No claimed vehicles yet
      </p>
      <p className="text-white/40 text-[12px] leading-relaxed mt-2">
        Use the same email address from your JDM Rush inquiry. Matching dockets are claimed automatically after login.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MyGarageHome() {
  const context = await getCustomerPortalContext({ nextPath: "/account" });
  const messagesHref = getDocketHref("/account/messages", context.latestDocket?.id);

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <PageHeader micro={`Welcome back, ${context.customerName} — your active imports are below. Tap any car to see where things stand.`} />

      <main id="main-content">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Car cards */}
          {context.dockets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[900px]">
              {context.dockets.map((docket) => (
                <CarCard key={docket.id} docket={docket} />
              ))}
            </div>
          ) : (
            <EmptyGarage />
          )}
        </div>
      </main>
    </div>
  );
}

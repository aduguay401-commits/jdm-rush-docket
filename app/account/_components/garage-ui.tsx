import Link from "next/link";
import type { ReactNode } from "react";

export type GarageIconName = "search" | "ship" | "check" | "car" | "receipt" | "document" | "agreement";

export function GarageIcon({ name }: { name: GarageIconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg {...common} aria-hidden>
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        </>
      )}
      {name === "ship" && (
        <>
          <path d="M3 17h18" />
          <path d="M5 17l2-8h10l2 8" />
          <path d="M8 9V5h8v4" />
          <path d="M7 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
        </>
      )}
      {name === "check" && (
        <>
          <path d="M20 6L9 17l-5-5" />
          <path d="M4 21h16" />
        </>
      )}
      {name === "car" && (
        <>
          <path d="M5 14l2-5h10l2 5" />
          <path d="M5 14h14v5H5z" />
          <circle cx="8" cy="19" r="1.5" />
          <circle cx="16" cy="19" r="1.5" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </>
      )}
      {name === "document" && (
        <>
          <path d="M14 3H6v18h12V7z" />
          <path d="M14 3v4h4" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </>
      )}
      {name === "agreement" && (
        <>
          <path d="M7 3h10v18H7z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M9 17l2 2 4-5" />
        </>
      )}
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="w-full min-w-0 max-w-full overflow-x-clip">
      <div className="mx-auto w-full min-w-0 max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
    </main>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string | number; tone?: "accent" | "muted" }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="min-h-[92px] border border-white/[0.08] bg-black px-4 py-4">
          <p className={`text-[28px] font-black leading-none ${stat.tone === "accent" ? "text-[#E55125]" : "text-white"}`}>
            {stat.value}
          </p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ActionBanner({
  href,
  label = "Action needed",
  title,
  body,
}: {
  href: string;
  label?: string;
  title: string;
  body?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[88px] items-center gap-4 border border-[#E55125]/25 bg-[#E55125]/10 px-4 py-4 text-left transition hover:border-[#E55125]/50 sm:px-5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#E55125] text-white">
        <GarageIcon name="agreement" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E55125]">{label}</p>
        <p className="mt-1 text-[16px] font-extrabold leading-tight text-white">{title}</p>
        {body && <p className="mt-1 text-[12px] leading-relaxed text-white/45">{body}</p>}
      </div>
      <span className="shrink-0 text-[#E55125]">
        <ChevronRight />
      </span>
    </Link>
  );
}

export function SpokeRow({
  href,
  icon,
  title,
  sub,
  count,
  status,
}: {
  href: string;
  icon: GarageIconName;
  title: string;
  sub: string;
  count?: string | number;
  status?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[84px] items-center gap-4 border border-white/[0.08] bg-black px-4 py-4 transition hover:border-white/[0.18] sm:px-5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.04] text-[#E55125]">
        <GarageIcon name={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[16px] font-extrabold leading-tight text-white">{title}</p>
          {typeof count !== "undefined" && (
            <span className="shrink-0 border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[10px] font-black text-white/55">
              {count}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/40">{sub}</p>
      </div>
      {status && (
        <span className="hidden shrink-0 border border-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/35 sm:inline-flex">
          {status}
        </span>
      )}
      <span className="shrink-0 text-white/25">
        <ChevronRight />
      </span>
    </Link>
  );
}

export const JOURNEY_STEPS = ["Purchased", "At Port", "On Vessel", "Customs", "Delivered"] as const;

export function JourneyMiniTrack({ currentStep = 1 }: { currentStep?: number }) {
  return (
    <div className="py-2" aria-label={`Import journey step ${currentStep} of ${JOURNEY_STEPS.length}`}>
      <div className="grid grid-cols-5">
        {JOURNEY_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isDone = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          return (
            <div key={step} className="min-w-0">
              <div className="flex items-center">
                <div className={`h-px flex-1 ${index === 0 ? "bg-transparent" : isDone || isCurrent ? "bg-[#E55125]" : "bg-white/[0.10]"}`} />
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    isCurrent ? "bg-[#E55125] ring-4 ring-[#E55125]/20" : isDone ? "bg-[#E55125]/70" : "border border-white/20"
                  }`}
                />
                <div className={`h-px flex-1 ${index === JOURNEY_STEPS.length - 1 ? "bg-transparent" : isDone ? "bg-[#E55125]" : "bg-white/[0.10]"}`} />
              </div>
              <p className={`mt-2 truncate px-1 text-center text-[10px] font-semibold ${isCurrent ? "text-white" : isDone ? "text-[#E55125]/60" : "text-white/25"}`}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ImportCard({
  href,
  vehicle,
  status,
  meta,
  showJourneyTrack = true,
}: {
  href: string;
  vehicle: string;
  status: string;
  meta: string;
  showJourneyTrack?: boolean;
}) {
  return (
    <Link href={href} className="block border border-white/[0.08] bg-black transition hover:border-white/[0.18]">
      <div className="flex aspect-[16/7] items-center justify-center bg-[#0a0a0a] text-white/[0.08]">
        <GarageIcon name="car" />
      </div>
      <div className="p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E55125]">{status}</p>
        <h2 className="mt-2 text-[18px] font-black leading-tight text-white">{vehicle}</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-white/40">{meta}</p>
        {showJourneyTrack && (
          <div className="mt-4">
            <JourneyMiniTrack currentStep={1} />
          </div>
        )}
      </div>
    </Link>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className="border border-white/[0.08] bg-black px-5 py-7">
      <p className="text-[18px] font-black leading-tight text-white">{title}</p>
      <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-white/40">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function StatusPill({ children, tone = "muted" }: { children: ReactNode; tone?: "accent" | "muted" | "good" }) {
  const className =
    tone === "accent"
      ? "border-[#E55125]/30 bg-[#E55125]/10 text-[#E55125]"
      : tone === "good"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        : "border-white/[0.08] bg-white/[0.04] text-white/35";

  return <span className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${className}`}>{children}</span>;
}

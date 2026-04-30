"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Docket = {
  id: string;
  created_at: string;
  status: string | null;
  docket_status_history: DocketStatusHistoryItem[] | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  vehicle_year: string | number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  destination_city: string | null;
  destination_province: string | null;
  budget_bracket: string | null;
  timeline: string | null;
};

type DocketStatusHistoryItem = {
  old_status: string | null;
  new_status: string | null;
  changed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  questions_sent: "Questions Sent",
  answers_received: "Answers Received",
  research_in_progress: "Research In Progress",
  report_sent: "Report Sent",
  decision_made: "Decision Made",
  cleared: "Cleared",
  lost: "Lost",
  paused: "Paused",
  unresponsive: "Unresponsive",
};

const STATUS_LINE_CONTENT: Record<string, { text: string; className: string }> = {
  new: {
    text: "🏎️ New lead — send first questions",
    className: "font-semibold text-[#4ade80]",
  },
  questions_sent: {
    text: "⏳ Questions sent. Monitoring for answers.",
    className: "font-normal text-[#888]",
  },
  answers_received: {
    text: "🏎️ Customer answered — respond or pull research",
    className: "font-semibold text-[#4ade80]",
  },
  research_in_progress: {
    text: "🏎️ Research in progress",
    className: "font-semibold text-[#fb923c]",
  },
  report_sent: {
    text: "⏳ Report sent. Awaiting customer decision.",
    className: "font-normal text-[#888]",
  },
  decision_made: {
    text: "🏎️ Customer approved — handoff to Adam",
    className: "font-semibold text-[#4ade80]",
  },
  cleared: {
    text: "✅ Deal cleared",
    className: "font-medium text-[#4ade80]",
  },
  unresponsive: {
    text: "⚠️ No response after follow-ups",
    className: "font-medium text-[#fbbf24]",
  },
  lost: {
    text: "✕ Lost",
    className: "font-normal text-[#666]",
  },
  paused: {
    text: "⏸ Paused",
    className: "font-normal text-[#666]",
  },
};

const STATUS_SORT_PRIORITY: Record<string, number> = {
  answers_received: 0,
  new: 1,
};

const PROGRESS_STAGES = [
  { label: "New", status: "new" },
  { label: "Communication", status: "communication" },
  { label: "Research", status: "research_in_progress" },
  { label: "Report Sent", status: "report_sent" },
  { label: "Decision", status: "decision_made" },
  { label: "Cleared", status: "cleared" },
] as const;

const PROGRESS_STAGE_INDEX_BY_STATUS: Record<string, number> = {
  new: 0,
  questions_sent: 1,
  answers_received: 1,
  research_in_progress: 2,
  report_sent: 3,
  decision_made: 4,
  cleared: 5,
};

const CURRENT_STAGE_STYLES: Record<string, string> = {
  new: "border-blue-300 bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]",
  questions_sent: "border-amber-200 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]",
  answers_received: "border-[#86efac] bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.55)]",
  research_in_progress: "border-[#ffb197] bg-[#E55125] shadow-[0_0_12px_rgba(229,81,37,0.6)]",
  report_sent: "border-blue-200 bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.55)]",
  decision_made: "border-[#86efac] bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.55)]",
  cleared: "border-emerald-200 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]",
};

const DIMMED_STATUS_SET = new Set(["unresponsive", "lost", "paused"]);

function formatStatus(status: string | null | undefined) {
  const normalized = status ?? "new";
  return STATUS_LABELS[normalized] ?? normalized;
}

function compareDocketsByUrgency(a: Docket, b: Docket) {
  const aPriority = STATUS_SORT_PRIORITY[a.status ?? "new"] ?? 2;
  const bPriority = STATUS_SORT_PRIORITY[b.status ?? "new"] ?? 2;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function buildVehicleLabel(
  year: string | number | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
) {
  const normalizedYear =
    typeof year === "number"
      ? String(year)
      : typeof year === "string" && year.trim().length > 0
        ? year.trim()
        : null;

  return [normalizedYear, make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function deriveDisplayNameFromEmail(email?: string | null) {
  if (!email) {
    return null;
  }

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) {
    return null;
  }

  const firstToken = localPart.split(/[._-]+/)[0]?.trim();
  if (!firstToken) {
    return null;
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

function sortStatusHistory(history: DocketStatusHistoryItem[] | null | undefined) {
  return Array.isArray(history)
    ? [...history].sort((a, b) => {
        const aTime = new Date(a.changed_at ?? 0).getTime();
        const bTime = new Date(b.changed_at ?? 0).getTime();
        return bTime - aTime;
      })
    : [];
}

function findPreviousPipelineStage(status: string, history: DocketStatusHistoryItem[] | null | undefined) {
  for (const item of sortStatusHistory(history)) {
    if (item.new_status === status && item.old_status && item.old_status in PROGRESS_STAGE_INDEX_BY_STATUS) {
      return PROGRESS_STAGE_INDEX_BY_STATUS[item.old_status];
    }

    if (item.new_status && item.new_status in PROGRESS_STAGE_INDEX_BY_STATUS) {
      return PROGRESS_STAGE_INDEX_BY_STATUS[item.new_status];
    }

    if (item.old_status && item.old_status in PROGRESS_STAGE_INDEX_BY_STATUS) {
      return PROGRESS_STAGE_INDEX_BY_STATUS[item.old_status];
    }
  }

  return 0;
}

function getProgressState(docket: Docket) {
  const status = docket.status ?? "new";

  if (status in PROGRESS_STAGE_INDEX_BY_STATUS) {
    return {
      currentIndex: PROGRESS_STAGE_INDEX_BY_STATUS[status],
      isDimmedCurrent: false,
      status,
    };
  }

  return {
    currentIndex: DIMMED_STATUS_SET.has(status) ? findPreviousPipelineStage(status, docket.docket_status_history) : 0,
    isDimmedCurrent: DIMMED_STATUS_SET.has(status),
    status,
  };
}

function DocketProgressBar({ docket }: { docket: Docket }) {
  const { currentIndex, isDimmedCurrent, status } = getProgressState(docket);

  return (
    <div aria-label={`Pipeline progress: ${formatStatus(status)}`} className="w-full py-3">
      <div className="grid grid-cols-6 items-start">
        {PROGRESS_STAGES.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const dotClass = isCurrent
            ? isDimmedCurrent
              ? "border-zinc-500 bg-zinc-600"
              : (CURRENT_STAGE_STYLES[status] ?? "border-white/50 bg-white/60")
            : isCompleted
              ? "border-white bg-white"
              : "border-zinc-700 bg-zinc-800";
          const leftLineClass = isCompleted || isCurrent ? "bg-white/65" : "bg-zinc-800";
          const rightLineClass = isCompleted ? "bg-white/65" : "bg-zinc-800";

          return (
            <div className="min-w-0" key={stage.status}>
              <div className="flex items-center">
                <div className={`h-0.5 flex-1 ${index === 0 ? "bg-transparent" : leftLineClass}`} />
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={`h-3 w-3 shrink-0 rounded-full border ${dotClass}`}
                  title={stage.label}
                />
                <div
                  className={`h-0.5 flex-1 ${index === PROGRESS_STAGES.length - 1 ? "bg-transparent" : rightLineClass}`}
                />
              </div>
              <p
                className={`mt-2 truncate text-center text-[10px] font-medium sm:text-xs ${
                  isCurrent ? "text-white" : isFuture ? "text-[#666]" : "text-[#888]"
                }`}
              >
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function getAgentProfile(userId: string, supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (byId.data?.role) {
    return {
      role: byId.data.role as string,
    };
  }

  return {
    role: null,
  };
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loading, setLoading] = useState(true);
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [agentDisplayName, setAgentDisplayName] = useState("there");

  useEffect(() => {
    async function loadDashboard() {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;

      if (!user) {
        router.replace("/agent/login");
        return;
      }

      const profile = await getAgentProfile(user.id, supabase);
      const role = profile.role;

      if (role !== "agent" && role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/agent/login");
        return;
      }

      setRole(role);
      setAgentDisplayName(deriveDisplayNameFromEmail(user.email) ?? "there");

      if (role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      const { data, error: docketError } = await supabase
        .from("dockets")
        .select(
          "id, created_at, status, customer_first_name, customer_last_name, vehicle_year, vehicle_make, vehicle_model, destination_city, destination_province, budget_bracket, timeline, docket_status_history(old_status, new_status, changed_at)"
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (docketError) {
        setError(docketError.message);
        setLoading(false);
        return;
      }

      setDockets([...((data as Docket[]) ?? [])].sort(compareDocketsByUrgency));
      setLoading(false);
    }

    void loadDashboard();
  }, [router, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/agent/login");
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <header className="relative mb-8 border-b border-white/10 pb-5">
          <div className="text-center">
            <img
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
              alt="JDM Rush Imports"
              style={{ height: "36px", display: "block", marginBottom: "4px" }}
            />
            <h1 className="mt-2 text-3xl font-semibold">Export Agent Dashboard</h1>
          </div>
          <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
            <div className="flex items-center gap-2">
              {role === "admin" ? (
                <Link
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  href="/admin/dashboard"
                >
                  Admin Dashboard
                </Link>
              ) : null}
              <button
                className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white"
                onClick={handleSignOut}
                type="button"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {loading ? <p className="text-white/75">Loading dockets...</p> : null}
        {error ? <p className="text-red-400">{error}</p> : null}

        {!loading && !error && dockets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center text-white/70">
            No dockets yet.
          </div>
        ) : null}

        {!loading && !error && dockets.length > 0 ? (
          <>
            <section className="pb-6">
              <h2 className="text-2xl font-semibold text-white">
                Welcome back, {agentDisplayName}. You&apos;ve got active dockets ready for your attention — let&apos;s
                get these deals moving. 🇯🇵
              </h2>
              <p className="mt-2 text-base text-[#888]">
                Each docket below represents a real buyer ready to find their perfect JDM vehicle. Review each one,
                pull your research, and let&apos;s get these deals moving. 🇯🇵
              </p>
            </section>
            <div className="grid gap-4">
              {dockets.map((docket) => {
                const status = docket.status ?? "new";
                const statusLine = STATUS_LINE_CONTENT[status] ?? {
                  text: formatStatus(status),
                  className: "font-normal text-[#888]",
                };
                const customerName =
                  `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() ||
                  "Unnamed Customer";
                const vehicle = buildVehicleLabel(docket.vehicle_year, docket.vehicle_make, docket.vehicle_model);
                const destination = [docket.destination_city, docket.destination_province].filter(Boolean).join(", ");

                return (
                  <article
                    className="overflow-hidden rounded-xl border border-white/12 bg-[#171717] shadow-lg"
                    key={docket.id}
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-white">{customerName}</h2>
                        <p className={`mt-2 mb-3 w-full text-left text-sm ${statusLine.className}`}>
                          {statusLine.text}
                        </p>
                        <p className="text-sm text-white/80">Vehicle: {vehicle || "N/A"}</p>
                        <p className="text-sm text-white/80">Destination: {destination || "N/A"}</p>
                        <p className="text-sm text-white/80">Budget: {docket.budget_bracket || "N/A"}</p>
                        <p className="text-sm text-white/80">Timeline: {docket.timeline || "N/A"}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                        <Link
                          className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                          href={`/agent/docket/${docket.id}`}
                        >
                          Open Docket
                        </Link>
                      </div>
                    </div>
                    <div className="rounded-b-xl border-t border-white/10 bg-white/[0.02] px-5 pb-5 pt-6">
                      <DocketProgressBar docket={docket} />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getLatestActivity,
  getProgressBarStage,
  getStatusDisplay,
  sortDocketsByUrgency,
} from "@/lib/dockets/dashboardDisplay";
import {
  countLeadViews,
  getLeadOriginLabel,
  isInLeadView,
  LEAD_VIEWS,
} from "@/lib/dockets/leadSource";
import type { LeadView } from "@/lib/dockets/leadSource";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Docket = {
  id: string;
  created_at: string;
  status: string | null;
  docket_status_history: DocketStatusHistoryItem[] | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_id: string | null;
  lead_source: string | null;
  unreadCount?: number | null;
  marcus_questions: MarcusQuestionItem[] | null;
  customer_questions: CustomerQuestionItem[] | null;
  email_log: EmailLogItem[] | null;
};

type DocketStatusHistoryItem = {
  old_status: string | null;
  new_status: string | null;
  changed_at: string | null;
};

type MarcusQuestionItem = {
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string | null;
};

type CustomerQuestionItem = {
  question_text: string | null;
  created_at: string | null;
  read_at?: string | null;
};

type EmailLogItem = {
  email_type: string | null;
  subject: string | null;
  body_snapshot: string | null;
  sent_at: string | null;
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

const PROGRESS_STAGES = [
  { label: "New", status: "new" },
  { label: "Communication", status: "communication" },
  { label: "Research", status: "research_in_progress" },
  { label: "Report Sent", status: "report_sent" },
  { label: "Decision", status: "decision_made" },
  { label: "Cleared", status: "cleared" },
] as const;

const DASHBOARD_REFRESH_FLAG = "dashboard_needs_refresh";
const DASHBOARD_SUCCESS_MESSAGE_KEY = "dashboard_success_message";

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#") && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }

  return color;
}

function formatStatus(status: string | null | undefined) {
  const normalized = status ?? "new";
  return STATUS_LABELS[normalized] ?? normalized;
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

function formatRelativeTime(timestamp: string) {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) {
    return "just now";
  }

  const diffMs = Date.now() - time;
  if (diffMs < 60_000) {
    return "just now";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (hours < 48) {
    return "yesterday";
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getNewMessageBadgeLabel(unreadCount: number) {
  if (unreadCount === 1) {
    return "NEW MESSAGE";
  }

  return `NEW MESSAGES (${unreadCount})`;
}

function LeadOriginBadge({ docket }: { docket: Pick<Docket, "customer_id" | "lead_source"> }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full border border-[#E55125]/35 bg-[#E55125]/10 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#f47a55]">
      {getLeadOriginLabel(docket)}
    </span>
  );
}

function DocketProgressBar({ docket }: { docket: Docket }) {
  const progressState = getProgressBarStage(docket.status, docket);
  const { currentIndex, status } = progressState;

  return (
    <div aria-label={`Pipeline progress: ${formatStatus(status)}`} className="w-full py-3">
      <div className="grid grid-cols-6 items-start">
        {PROGRESS_STAGES.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const dotClass = isCurrent
            ? progressState.currentStageClassName
            : isCompleted
              ? progressState.completedStageClassName
              : progressState.futureStageClassName;
          const leftLineClass =
            isCompleted || isCurrent ? progressState.completedLineClassName : progressState.futureLineClassName;
          const rightLineClass = isCompleted ? progressState.completedLineClassName : progressState.futureLineClassName;

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
  const [activeLeadView, setActiveLeadView] = useState<LeadView>("all");
  const [dashboardSuccessMessage, setDashboardSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
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
        "id, created_at, status, customer_first_name, customer_last_name, customer_id, lead_source, docket_status_history(old_status, new_status, changed_at), marcus_questions(question_text, answer_text, answered_at, created_at), customer_questions(question_text, created_at), email_log(email_type, subject, body_snapshot, sent_at)"
      )
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (docketError) {
      setError(docketError.message);
      setLoading(false);
      return;
    }

    setError(null);
    const loadedDockets = ((data as Docket[]) ?? []).map((docket) => ({ ...docket, unreadCount: 0 }));
    const docketIds = loadedDockets.map((docket) => docket.id);

    if (docketIds.length > 0) {
      const { data: unreadRows, error: unreadError } = await supabase
        .from("customer_questions")
        .select("docket_id")
        .in("docket_id", docketIds)
        .is("read_at", null);

      if (unreadError) {
        setError(unreadError.message);
        setLoading(false);
        return;
      }

      const unreadCountByDocketId = new Map<string, number>();
      for (const row of unreadRows ?? []) {
        const docketId = typeof row.docket_id === "string" ? row.docket_id : null;
        if (!docketId) {
          continue;
        }

        unreadCountByDocketId.set(docketId, (unreadCountByDocketId.get(docketId) ?? 0) + 1);
      }

      for (const docket of loadedDockets) {
        docket.unreadCount = unreadCountByDocketId.get(docket.id) ?? 0;
      }
    }

    setDockets(sortDocketsByUrgency(loadedDockets));
    setLastRefreshedAt(new Date().toISOString());
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    if (window.sessionStorage.getItem(DASHBOARD_REFRESH_FLAG)) {
      window.sessionStorage.removeItem(DASHBOARD_REFRESH_FLAG);
    }

    const timeoutId = window.setTimeout(() => {
      const successMessage = window.sessionStorage.getItem(DASHBOARD_SUCCESS_MESSAGE_KEY);
      if (successMessage) {
        window.sessionStorage.removeItem(DASHBOARD_SUCCESS_MESSAGE_KEY);
        setDashboardSuccessMessage(successMessage);
      }

      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadDashboard]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (window.sessionStorage.getItem(DASHBOARD_REFRESH_FLAG)) {
          window.sessionStorage.removeItem(DASHBOARD_REFRESH_FLAG);
        }

        void loadDashboard();
      }
    }

    function handleDashboardRefresh() {
      if (window.sessionStorage.getItem(DASHBOARD_REFRESH_FLAG)) {
        window.sessionStorage.removeItem(DASHBOARD_REFRESH_FLAG);
      }

      void loadDashboard();
    }

    window.addEventListener("focus", handleDashboardRefresh);
    window.addEventListener("pageshow", handleDashboardRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleDashboardRefresh);
      window.removeEventListener("pageshow", handleDashboardRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard]);

  const leadViewCounts = useMemo(() => countLeadViews(dockets), [dockets]);

  const filteredDockets = useMemo(
    () => sortDocketsByUrgency(dockets.filter((docket) => isInLeadView(docket, activeLeadView))),
    [activeLeadView, dockets],
  );

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
        {dashboardSuccessMessage ? (
          <div className="mb-4 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-sm font-medium text-[#4ade80]">
            {dashboardSuccessMessage}
          </div>
        ) : null}
        {error ? <p className="text-red-400">{error}</p> : null}

        {!loading && !error && dockets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center text-white/70">
            No dockets yet.
          </div>
        ) : null}

        {!loading && !error && dockets.length > 0 ? (
          <>
            <section className="mb-5 grid gap-2 rounded-xl border border-white/10 bg-[#141414] p-1 sm:grid-cols-4">
              {LEAD_VIEWS.map((view) => {
                const isActiveView = activeLeadView === view.id;
                return (
                  <button
                    aria-pressed={isActiveView}
                    className={`rounded-lg px-4 py-3 text-left transition ${
                      isActiveView ? "bg-[#E55125] text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                    key={view.id}
                    onClick={() => setActiveLeadView(view.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{view.label}</span>
                      <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-semibold">
                        {leadViewCounts[view.id]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs opacity-75">{view.description}</span>
                  </button>
                );
              })}
            </section>

            <section className="pb-6">
              <h2 className="text-2xl font-semibold text-white">
                Welcome back, {agentDisplayName}. You&apos;ve got active dockets ready for your attention — let&apos;s
                get these deals moving. 🇯🇵
              </h2>
              {lastRefreshedAt ? (
                <p className="mt-1 text-[13px] text-[#888]">Updated {formatRelativeTime(lastRefreshedAt)}</p>
              ) : null}
              <p className="mt-2 text-base text-[#888]">
                Each docket below represents a real buyer ready to find their perfect JDM vehicle. Review each one,
                pull your research, and let&apos;s get these deals moving. 🇯🇵
              </p>
            </section>
            <div className="grid gap-4">
              {filteredDockets.map((docket) => {
                const lastCommunication = getLatestActivity(docket);
                const statusDisplay = getStatusDisplay(docket, lastCommunication);
                const unreadCount = statusDisplay.unreadCount;
                const stripeColor = statusDisplay.stripeColor;
                const customerName =
                  `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() ||
                  "Unnamed Customer";

                return (
                  <article
                    className="overflow-hidden rounded-xl border border-white/12 bg-[#171717] shadow-lg"
                    key={docket.id}
                  >
                    <div className="p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-semibold text-white">{customerName}</h2>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <LeadOriginBadge docket={docket} />
                          </div>
                        </div>
                        <Link
                          className="shrink-0 rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                          href={`/agent/docket/${docket.id}`}
                        >
                          Open Docket
                        </Link>
                      </div>
                      <div className="mb-2 h-[3px] w-full rounded-[2px]" style={{ backgroundColor: stripeColor }} />
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <p className={`text-sm ${statusDisplay.className}`}>{statusDisplay.text}</p>
                        {unreadCount > 0 ? (
                          <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full border border-[#4ade80]/40 bg-[#4ade80]/15 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#4ade80]">
                            {getNewMessageBadgeLabel(unreadCount)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="rounded bg-white/[0.03] px-[14px] py-2.5"
                        style={{ borderLeft: `2px solid ${withAlpha(stripeColor, 0.4)}` }}
                      >
                        {lastCommunication ? (
                          <>
                            <p className="text-xs text-[#888]">
                              {lastCommunication.directionLabel} · {formatRelativeTime(lastCommunication.timestamp)}
                            </p>
                            {lastCommunication.snippet ? (
                              <p className="mt-1 text-[13px] leading-6 text-[#ccc]">{lastCommunication.snippet}</p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-[#888]">🎌 New lead — no communication yet</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-b-xl border-t border-white/10 bg-white/[0.02] px-5 pb-5 pt-3">
                      <DocketProgressBar docket={docket} />
                    </div>
                  </article>
                );
              })}
              {filteredDockets.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#131313] p-6 text-center text-sm text-white/60">
                  No dockets match this lead view.
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

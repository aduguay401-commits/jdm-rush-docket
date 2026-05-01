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
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Docket = {
  id: string;
  created_at: string;
  status: string | null;
  docket_status_history: DocketStatusHistoryItem[] | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
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
        "id, created_at, status, customer_first_name, customer_last_name, docket_status_history(old_status, new_status, changed_at), marcus_questions(question_text, answer_text, answered_at, created_at), customer_questions(question_text, created_at), email_log(email_type, subject, body_snapshot, sent_at)"
      )
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (docketError) {
      setError(docketError.message);
      setLoading(false);
      return;
    }

    setError(null);
    setDockets(sortDocketsByUrgency((data as Docket[]) ?? []));
    setLastRefreshedAt(new Date().toISOString());
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    if (window.sessionStorage.getItem(DASHBOARD_REFRESH_FLAG)) {
      window.sessionStorage.removeItem(DASHBOARD_REFRESH_FLAG);
    }

    void loadDashboard();
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
              {lastRefreshedAt ? (
                <p className="mt-1 text-[13px] text-[#888]">Updated {formatRelativeTime(lastRefreshedAt)}</p>
              ) : null}
              <p className="mt-2 text-base text-[#888]">
                Each docket below represents a real buyer ready to find their perfect JDM vehicle. Review each one,
                pull your research, and let&apos;s get these deals moving. 🇯🇵
              </p>
            </section>
            <div className="grid gap-4">
              {dockets.map((docket) => {
                const lastCommunication = getLatestActivity(docket);
                const statusDisplay = getStatusDisplay(docket, lastCommunication);
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
                        <h2 className="text-xl font-semibold text-white">{customerName}</h2>
                        <Link
                          className="shrink-0 rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                          href={`/agent/docket/${docket.id}`}
                        >
                          Open Docket
                        </Link>
                      </div>
                      <div className="mb-2 h-[3px] w-full rounded-[2px]" style={{ backgroundColor: stripeColor }} />
                      <p className={`mb-4 text-sm ${statusDisplay.className}`}>{statusDisplay.text}</p>
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
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type LastCommunication = {
  direction: "agent" | "customer";
  directionLabel: string;
  snippet: string | null;
  timestamp: string;
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
    className: "font-normal text-[#aaa]",
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
    className: "font-normal text-[#aaa]",
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
const DASHBOARD_REFRESH_FLAG = "dashboard_needs_refresh";

const STATUS_STRIPE_COLORS: Record<string, string> = {
  new: "#4ade80",
  questions_sent: "rgba(168,162,158,0.5)",
  answers_received: "#4ade80",
  research_in_progress: "#fb923c",
  report_sent: "rgba(168,162,158,0.5)",
  decision_made: "#4ade80",
  cleared: "#4ade80",
  unresponsive: "#fbbf24",
  lost: "#525252",
  paused: "#525252",
};

type StatusDisplay = {
  text: string;
  className: string;
  stripeColor: string;
};

const ACTION_STRIPE_COLOR = "#4ade80";
const WAITING_STRIPE_COLOR = "rgba(168,162,158,0.5)";

function getStatusStripeColor(status: string | null | undefined) {
  return STATUS_STRIPE_COLORS[status ?? "new"] ?? WAITING_STRIPE_COLOR;
}

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

function compareDocketsByUrgency(a: Docket, b: Docket) {
  const aPriority = STATUS_SORT_PRIORITY[a.status ?? "new"] ?? 2;
  const bPriority = STATUS_SORT_PRIORITY[b.status ?? "new"] ?? 2;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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

function truncateSnippet(value: string | null | undefined, maxLength = 100) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}...` : normalized;
}

function getEmailTypeLabel(emailType: string | null | undefined) {
  if (!emailType) {
    return "Email sent";
  }

  if (emailType.startsWith("email_1_")) {
    return "Welcome email";
  }

  if (emailType.startsWith("email_2_")) {
    return "Questions sent";
  }

  if (emailType.startsWith("email_4_")) {
    return "Report sent";
  }

  if (emailType.startsWith("email_5_")) {
    return "Approval next steps";
  }

  if (emailType === "manual_reminder") {
    return "Manual reminder";
  }

  if (emailType.startsWith("sequence_")) {
    return "Follow-up";
  }

  return "Email sent";
}

function getLastCommunication(docket: Docket): LastCommunication | null {
  const customerFirstName = docket.customer_first_name?.trim() || "Customer";
  const candidates: LastCommunication[] = [];

  for (const question of docket.marcus_questions ?? []) {
    if (question.answer_text?.trim() && question.answered_at) {
      candidates.push({
        direction: "customer",
        directionLabel: `📥 ${customerFirstName}`,
        snippet: truncateSnippet(question.answer_text),
        timestamp: question.answered_at,
      });
      continue;
    }

    if (question.question_text?.trim() && question.created_at) {
      candidates.push({
        direction: "agent",
        directionLabel: "📤 You",
        snippet: truncateSnippet(question.question_text),
        timestamp: question.created_at,
      });
    }
  }

  for (const question of docket.customer_questions ?? []) {
    if (question.question_text?.trim() && question.created_at) {
      candidates.push({
        direction: "customer",
        directionLabel: `📥 ${customerFirstName}`,
        snippet: truncateSnippet(question.question_text),
        timestamp: question.created_at,
      });
    }
  }

  for (const email of docket.email_log ?? []) {
    if (email.sent_at) {
      const label = getEmailTypeLabel(email.email_type);
      candidates.push({
        direction: "agent",
        directionLabel: label === "Report sent" ? "📤 Report sent" : `📤 ${label}`,
        snippet: truncateSnippet(email.subject || `${label} sent.`),
        timestamp: email.sent_at,
      });
    }
  }

  return candidates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null;
}

function getStatusDisplay(status: string | null | undefined, lastCommunication: LastCommunication | null): StatusDisplay {
  const normalizedStatus = status ?? "new";
  const defaultStatusLine = STATUS_LINE_CONTENT[normalizedStatus] ?? {
    text: formatStatus(normalizedStatus),
    className: "font-normal text-[#888]",
  };

  if (normalizedStatus === "answers_received" && lastCommunication?.direction === "agent") {
    return {
      text: "⏳ Follow-up sent. Awaiting customer response.",
      className: "font-normal text-[#aaa]",
      stripeColor: WAITING_STRIPE_COLOR,
    };
  }

  if (
    (normalizedStatus === "questions_sent" ||
      normalizedStatus === "report_sent" ||
      normalizedStatus === "research_in_progress") &&
    lastCommunication?.direction === "customer"
  ) {
    return {
      text: "🏎️ Customer asked a question — respond",
      className: "font-semibold text-[#4ade80]",
      stripeColor: ACTION_STRIPE_COLOR,
    };
  }

  return {
    ...defaultStatusLine,
    stripeColor: getStatusStripeColor(normalizedStatus),
  };
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
    setDockets([...((data as Docket[]) ?? [])].sort(compareDocketsByUrgency));
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
                const status = docket.status ?? "new";
                const lastCommunication = getLastCommunication(docket);
                const statusDisplay = getStatusDisplay(status, lastCommunication);
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

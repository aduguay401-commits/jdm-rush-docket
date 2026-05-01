"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { NormalizedAdminDocket } from "@/lib/admin/types";
import {
  getLatestActivity,
  getProgressBarStage,
  getStatusDisplay,
  sortDocketsByUrgency,
} from "@/lib/dockets/dashboardDisplay";
import { getDocketActivityFeed, type DocketActivityEvent } from "@/lib/dockets/activityFeed";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  initialDockets: NormalizedAdminDocket[];
};

type StatusFilter = "all" | "needs_attention" | "active" | "approved" | "paused" | "cleared" | "lost";
type DrawerTab = "activity" | "notes";

type PatchPayload = {
  status?: string | null;
  admin_notes?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
};

const PROGRESS_STAGES = [
  { label: "New", status: "new" },
  { label: "Communication", status: "communication" },
  { label: "Research", status: "research_in_progress" },
  { label: "Report Sent", status: "report_sent" },
  { label: "Decision", status: "decision_made" },
  { label: "Cleared", status: "cleared" },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatStatus(status: string | null | undefined) {
  switch (status) {
    case "new":
      return "New";
    case "questions_sent":
      return "Questions Sent";
    case "answers_received":
      return "Answers Received";
    case "research_in_progress":
      return "Research In Progress";
    case "report_sent":
      return "Report Sent";
    case "decision_made":
      return "Decision Made";
    case "cleared":
      return "Cleared";
    case "lost":
      return "Lost";
    case "paused":
      return "Paused";
    case "unresponsive":
      return "Unresponsive";
    case "archived":
      return "Archived";
    default:
      return "New";
  }
}

function getCustomerName(docket: NormalizedAdminDocket) {
  return `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() || "Unnamed Customer";
}

function getVehicleLabel(docket: NormalizedAdminDocket) {
  return [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model].filter(Boolean).join(" ") || "N/A";
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

function isPaused(docket: NormalizedAdminDocket) {
  return docket.status === "paused";
}

function isNeedsAttention(docket: NormalizedAdminDocket) {
  if (isPaused(docket)) {
    return false;
  }

  return docket.is_flagged || docket.status === "new" || docket.status === "answers_received";
}

function isActive(docket: NormalizedAdminDocket) {
  return !isPaused(docket) && docket.status !== "cleared" && docket.status !== "lost";
}

function getLocationLabel(docket: NormalizedAdminDocket) {
  return [docket.destination_city, docket.destination_province].filter(Boolean).join(", ") || "N/A";
}

function getProgressStageText(docket: NormalizedAdminDocket) {
  const progress = getProgressBarStage(docket.status, docket);
  return `stage ${Math.min(progress.currentIndex + 1, PROGRESS_STAGES.length)}/${PROGRESS_STAGES.length}`;
}

function getLastReminder(docket: NormalizedAdminDocket) {
  return docket.email_log
    .filter((entry) => entry.email_type === "manual_reminder" && entry.sent_at)
    .sort((a, b) => new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime())[0] ?? null;
}

function hasUnansweredMarcusQuestions(docket: NormalizedAdminDocket) {
  return docket.marcus_questions.some((question) => !question.answer_text?.trim());
}

function isExpandableActivityEvent(event: DocketActivityEvent) {
  return event.category === "customer_message" || event.category === "agent_message";
}

function DocketProgressBar({ docket }: { docket: NormalizedAdminDocket }) {
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

export default function AdminDashboardClient({ initialDockets }: Props) {
  const [dockets, setDockets] = useState<NormalizedAdminDocket[]>(initialDockets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [selectedDocketId, setSelectedDocketId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>("activity");
  const [expandedActivityEventIds, setExpandedActivityEventIds] = useState<Set<string>>(new Set());
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [notesSavedState, setNotesSavedState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastNotesSavedAt, setLastNotesSavedAt] = useState<string | null>(null);

  const selectedDocket = useMemo(
    () => dockets.find((docket) => docket.id === selectedDocketId) ?? null,
    [dockets, selectedDocketId]
  );

  const activityFeed = useMemo(() => {
    if (!selectedDocket) {
      return [];
    }

    return getDocketActivityFeed(selectedDocket);
  }, [selectedDocket]);

  const lastReminder = useMemo(() => {
    if (!selectedDocket) {
      return null;
    }

    return getLastReminder(selectedDocket);
  }, [selectedDocket]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedDocketId(null);
      }
    }

    if (selectedDocketId) {
      window.addEventListener("keydown", onEscape);
    }

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [selectedDocketId]);

  useEffect(() => {
    setExpandedActivityEventIds(new Set());
  }, [selectedDocketId]);

  async function refreshDockets(archivedOnly: boolean = showArchived) {
    setLoading(true);
    setError(null);

    const query = archivedOnly ? "?archived=true" : "";
    const response = await fetch(`/api/admin/dockets${query}`, { method: "GET" });
    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      dockets?: NormalizedAdminDocket[];
    };

    if (!response.ok || !result.success || !result.dockets) {
      setError(result.error ?? "Failed to load dockets");
      setLoading(false);
      return;
    }

    setDockets(result.dockets);
    setLoading(false);
  }

  async function patchDocket(id: string, payload: PatchPayload, options?: { refreshAfter?: boolean }) {
    const refreshAfter = options?.refreshAfter ?? true;
    const response = await fetch(`/api/admin/dockets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { success: boolean; error?: string };

    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Failed to update docket");
    }

    if (refreshAfter) {
      await refreshDockets(showArchived);
    }
  }

  async function handleArchiveSelectedDocket() {
    if (!selectedDocket) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure? This docket will be hidden from your main view. You can find it using the Archived filter anytime."
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const archivedAt = new Date().toISOString();
      await patchDocket(selectedDocket.id, { is_archived: true, archived_at: archivedAt }, { refreshAfter: false });
      setDockets((previous) => previous.filter((docket) => docket.id !== selectedDocket.id));
      setSelectedDocketId(null);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive docket");
    }
  }

  async function handleUnarchiveDocket(id: string) {
    setError(null);

    try {
      await patchDocket(id, { is_archived: false, archived_at: null }, { refreshAfter: false });
      if (selectedDocketId === id) {
        setSelectedDocketId(null);
      }
      await refreshDockets(showArchived);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to unarchive docket");
    }
  }

  async function handleSendReminder(id: string) {
    setSendingReminderId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/remind/${id}`, { method: "POST" });
      const result = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to send reminder");
      }

      await refreshDockets();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send reminder");
    }

    setSendingReminderId(null);
  }

  function handleOpenDrawer(docketId: string) {
    const docket = dockets.find((item) => item.id === docketId);
    setAdminNotesDraft(docket?.admin_notes ?? "");
    setNotesSavedState("idle");
    setLastNotesSavedAt(null);
    setActiveDrawerTab("activity");
    setSelectedDocketId(docketId);
  }

  function toggleActivityEvent(event: DocketActivityEvent) {
    if (!isExpandableActivityEvent(event)) {
      return;
    }

    setExpandedActivityEventIds((previous) => {
      const next = new Set(previous);
      if (next.has(event.id)) {
        next.delete(event.id);
      } else {
        next.add(event.id);
      }
      return next;
    });
  }

  async function saveAdminNotes() {
    if (!selectedDocket) {
      return;
    }

    if ((selectedDocket.admin_notes ?? "") === adminNotesDraft) {
      return;
    }

    setNotesSavedState("saving");

    try {
      await patchDocket(selectedDocket.id, { admin_notes: adminNotesDraft || null });
      setLastNotesSavedAt(new Date().toISOString());
      setNotesSavedState("saved");
    } catch (updateError) {
      setNotesSavedState("idle");
      setError(updateError instanceof Error ? updateError.message : "Failed to save admin notes");
    }
  }

  function handleSelectDrawerTab(tab: DrawerTab) {
    if (activeDrawerTab === "notes" && tab !== "notes") {
      void saveAdminNotes();
    }

    setActiveDrawerTab(tab);
  }

  async function handleMarkSelectedDocketAsLost() {
    if (!selectedDocket) {
      return;
    }

    const confirmed = window.confirm(
      "Mark this docket as lost? This action is for record-keeping; the docket will be hidden from active views."
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/admin/dockets/${selectedDocket.id}/mark-lost`, { method: "POST" });
      const result = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to mark docket as lost");
      }

      await refreshDockets(showArchived);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to mark docket as lost");
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/agent/login";
  }

  async function handleToggleArchivedView() {
    const nextShowArchived = !showArchived;
    setShowArchived(nextShowArchived);
    setSelectedDocketId(null);
    await refreshDockets(nextShowArchived);
  }

  const metrics = useMemo(() => {
    const active = dockets.filter(isActive).length;
    const needsAttention = dockets.filter(isNeedsAttention).length;
    const approvedPending = dockets.filter((docket) => docket.status === "decision_made").length;

    return {
      active,
      needsAttention,
      approvedPending,
    };
  }, [dockets]);

  const filteredDockets = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();

    const filtered = dockets.filter((docket) => {
      if (showArchived ? docket.is_archived !== true : docket.is_archived !== false) {
        return false;
      }

      const customerName = getCustomerName(docket).toLowerCase();
      const vehicle = getVehicleLabel(docket).toLowerCase();
      const textMatches = text.length === 0 || customerName.includes(text) || vehicle.includes(text);

      if (!textMatches) {
        return false;
      }

      if (flaggedOnly && !docket.is_flagged) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }
      if (statusFilter === "needs_attention") {
        return isNeedsAttention(docket);
      }
      if (statusFilter === "active") {
        return isActive(docket);
      }
      if (statusFilter === "approved") {
        return docket.status === "decision_made";
      }
      if (statusFilter === "paused") {
        return isPaused(docket);
      }
      if (statusFilter === "cleared") {
        return docket.status === "cleared";
      }
      if (statusFilter === "lost") {
        return docket.status === "lost";
      }
      return true;
    });

    return sortDocketsByUrgency(filtered);
  }, [dockets, flaggedOnly, searchTerm, showArchived, statusFilter]);

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-6 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <header className="mb-6 border-b border-white/10 pb-4">
          <img
            src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
            alt="JDM Rush Imports"
            style={{ height: "36px", display: "block", marginBottom: "4px" }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold">Admin Pipeline Dashboard</h1>
            <div className="flex items-center gap-2">
              <Link
                className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm text-gray-400 transition-colors hover:border-[#E55125] hover:text-[#E55125]"
                href="/admin/agents"
              >
                Manage Agents
              </Link>
              <button
                className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm text-gray-400 transition-colors hover:border-[#E55125] hover:text-[#E55125]"
                onClick={() => void handleToggleArchivedView()}
                type="button"
              >
                {showArchived ? "Active Dockets" : "Archived"}
              </button>
              <button
                className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm text-gray-400 transition-colors hover:border-[#E55125] hover:text-[#E55125]"
                onClick={() => void handleLogout()}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {showArchived ? (
          <div className="mb-5 rounded-md border border-orange-400/20 border-l-4 border-l-orange-400/70 bg-orange-950/20 px-4 py-3 text-sm text-orange-100">
            Viewing archived dockets
          </div>
        ) : (
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
              <p className="text-xs uppercase tracking-wider text-white/60">Total Active Dockets</p>
              <p className="mt-2 text-3xl font-semibold">{metrics.active}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
              <p className="text-xs uppercase tracking-wider text-white/60">Needs Attention</p>
              <p className="mt-2 text-3xl font-semibold text-orange-300">{metrics.needsAttention}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
              <p className="text-xs uppercase tracking-wider text-white/60">Approved - Pending Deposit</p>
              <p className="mt-2 text-3xl font-semibold text-green-300">{metrics.approvedPending}</p>
            </article>
          </section>
        )}

        <section className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-[#141414] p-4 md:grid-cols-[1fr_220px_auto] md:items-center">
          <input
            className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
            placeholder="Search by customer or vehicle"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="active">Active</option>
            <option value="approved">Approved</option>
            <option value="paused">Paused</option>
            <option value="cleared">Cleared</option>
            <option value="lost">Lost</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-white/85">
            <input
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
              type="checkbox"
            />
            Flagged only
          </label>
        </section>

        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <section className="grid gap-4">
          {filteredDockets.map((docket) => {
            const lastCommunication = getLatestActivity(docket);
            const statusLine = getStatusDisplay(docket, lastCommunication);
            const stripeColor = statusLine.stripeColor;

            return (
              <article className="overflow-hidden rounded-xl border border-white/12 bg-[#171717] shadow-lg" key={docket.id}>
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold text-white">{getCustomerName(docket)}</h2>
                    <button
                      className="shrink-0 rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                      onClick={() => handleOpenDrawer(docket.id)}
                      type="button"
                    >
                      Open Docket
                    </button>
                  </div>
                  <div className="mb-2 h-[3px] w-full rounded-[2px]" style={{ backgroundColor: stripeColor }} />
                  <p className={`mb-4 text-sm ${statusLine.className}`}>{statusLine.text}</p>
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
              No dockets match your filters.
            </div>
          ) : null}
        </section>

        {loading ? <p className="mt-3 text-sm text-white/60">Refreshing dockets...</p> : null}
      </div>

      {selectedDocket
        ? (() => {
            const statusDisplay = getStatusDisplay(selectedDocket);
            const vehicleDescription = selectedDocket.vehicle_description?.trim() || getVehicleLabel(selectedDocket);
            const isArchived = selectedDocket.is_archived === true;
            const isLost = selectedDocket.status === "lost";
            const hasUnansweredQuestions = hasUnansweredMarcusQuestions(selectedDocket);
            const conversationLink = hasUnansweredQuestions
              ? selectedDocket.questions_url_token
                ? `https://docket.jdmrushimports.ca/questions/${selectedDocket.questions_url_token}`
                : null
              : `/admin/conversation/${selectedDocket.id}`;
            const conversationLinkLabel = hasUnansweredQuestions ? "View Questions" : "View Conversation";

            return (
              <div className="fixed inset-0 z-30 bg-black/55" onClick={() => setSelectedDocketId(null)}>
                <aside
                  className="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto border-l border-white/10 bg-[#111111] p-5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-2xl font-bold">{getCustomerName(selectedDocket)}</h2>
                      <p className="truncate text-sm text-white/65">
                        {selectedDocket.customer_email || "N/A"} · {selectedDocket.customer_phone || "N/A"}
                      </p>
                      <p className="truncate text-sm text-white/65">{getLocationLabel(selectedDocket)}</p>
                      <p className="truncate text-sm text-white/80" title={vehicleDescription}>
                        {vehicleDescription}
                      </p>
                      <p className="text-sm text-white/70">
                        Currently: {statusDisplay.text} · {getProgressStageText(selectedDocket)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {selectedDocket.report_url_token ? (
                          <a
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:border-[#E55125] hover:text-[#E55125]"
                            href={`https://docket.jdmrushimports.ca/report/${selectedDocket.report_url_token}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span aria-hidden="true">📄</span>
                            View Report
                          </a>
                        ) : null}
                        {conversationLink ? (
                          <a
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:border-[#E55125] hover:text-[#E55125]"
                            href={conversationLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span aria-hidden="true">💬</span>
                            {conversationLinkLabel}
                          </a>
                        ) : null}
                        <button
                          className="inline-flex items-center rounded-md border border-[#E55125]/70 px-3 py-1.5 text-sm text-[#E55125] transition hover:bg-[#E55125]/10 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={sendingReminderId === selectedDocket.id}
                          onClick={() => void handleSendReminder(selectedDocket.id)}
                          type="button"
                        >
                          {sendingReminderId === selectedDocket.id ? "Sending..." : "Send Reminder"}
                        </button>
                      </div>
                      {lastReminder?.sent_at ? (
                        <p className="pt-1 text-xs text-white/45">
                          Last reminder: {formatDate(lastReminder.sent_at)} · {formatRelativeTime(lastReminder.sent_at)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                      onClick={() => setSelectedDocketId(null)}
                      type="button"
                    >
                      X
                    </button>
                  </div>

                  <div className="border-b border-white/10">
                    <div className="grid grid-cols-2 rounded-md border border-white/10 bg-black/20 p-1">
                      {(["activity", "notes"] as const).map((tab) => (
                        <button
                          className={`rounded px-3 py-2 text-sm font-medium transition ${
                            activeDrawerTab === tab ? "bg-[#E55125] text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                          }`}
                          key={tab}
                          onClick={() => handleSelectDrawerTab(tab)}
                          type="button"
                        >
                          {tab === "activity" ? "Activity" : "Notes"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeDrawerTab === "activity" ? (
                    <section className="py-4">
                      {activityFeed.length === 0 ? <p className="text-sm text-white/50">No activity yet</p> : null}
                      <div className="relative space-y-3 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-[#444]">
                        {activityFeed.map((event) => {
                          const expandable = isExpandableActivityEvent(event) && event.expandable_content;
                          const expanded = expandedActivityEventIds.has(event.id);
                          const RowElement = expandable ? "button" : "div";

                          return (
                            <article className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3" key={event.id}>
                              <span
                                aria-hidden="true"
                                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-base ${event.colorClass}`}
                              >
                                {event.icon}
                              </span>
                              <div className="rounded-md border border-white/10 bg-black/20">
                                <RowElement
                                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left ${
                                    expandable ? "transition hover:bg-white/5" : ""
                                  }`}
                                  onClick={expandable ? () => toggleActivityEvent(event) : undefined}
                                  type={expandable ? "button" : undefined}
                                >
                                  <span className="min-w-0 truncate text-sm text-white/85">{event.title}</span>
                                  <span className="whitespace-nowrap text-xs text-white/45">{formatDate(event.timestamp)}</span>
                                </RowElement>
                              {expanded && event.expandable_content ? (
                                <div className="border-t border-white/10 px-3 py-3 text-sm leading-6 text-white/70">
                                  <p className="whitespace-pre-line">{event.expandable_content}</p>
                                </div>
                              ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="py-4">
                      <label className="block text-xs uppercase tracking-wider text-white/60">
                        Admin notes
                        <textarea
                          className="mt-2 min-h-[220px] w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E55125]"
                          onBlur={() => void saveAdminNotes()}
                          onChange={(event) => {
                            setAdminNotesDraft(event.target.value);
                            if (notesSavedState === "saved") {
                              setNotesSavedState("idle");
                            }
                          }}
                          value={adminNotesDraft}
                        />
                      </label>
                      <p className="mt-2 text-xs text-white/45">
                        {notesSavedState === "saving"
                          ? "Saving..."
                          : lastNotesSavedAt
                            ? `Last saved ${formatDate(lastNotesSavedAt)}`
                            : ""}
                      </p>
                    </section>
                  )}

                  <section className="mt-2 border-t border-white/10 pt-4">
                    {isArchived ? (
                      <button
                        className="w-full rounded-md border border-[#ef4444] bg-transparent px-4 py-3 text-sm font-medium text-[#ef4444] transition hover:bg-red-500/10"
                        onClick={() => void handleUnarchiveDocket(selectedDocket.id)}
                        type="button"
                      >
                        Unarchive
                      </button>
                    ) : (
                      <div className={isLost ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
                        {!isLost ? (
                          <button
                            className="rounded-md border border-[#ef4444] bg-transparent px-4 py-3 text-sm font-medium text-[#ef4444] transition hover:bg-red-500/10"
                            onClick={() => void handleMarkSelectedDocketAsLost()}
                            type="button"
                          >
                            Mark as Lost
                          </button>
                        ) : null}
                        <button
                          className="rounded-md border border-[#ef4444] bg-transparent px-4 py-3 text-sm font-medium text-[#ef4444] transition hover:bg-red-500/10"
                          onClick={() => void handleArchiveSelectedDocket()}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </section>
                </aside>
              </div>
            );
          })()
        : null}
    </main>
  );
}

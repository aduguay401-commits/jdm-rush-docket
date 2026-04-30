"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CustomerQuestionItem, MarcusQuestionItem, NormalizedAdminDocket } from "@/lib/admin/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  initialDockets: NormalizedAdminDocket[];
};

type StatusFilter = "all" | "needs_attention" | "active" | "approved" | "paused" | "cleared" | "lost";
type EmailStage = "Intake" | "Questions" | "Research" | "Decision" | "Follow-up";

type PatchPayload = {
  status?: string | null;
  admin_notes?: string | null;
  is_flagged?: boolean | null;
  is_paused?: boolean | null;
  paused_until?: string | null;
  lost_reason?: string | null;
  estimated_deal_value?: number | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
};

type CustomerCommunicationTimelineEntry =
  | {
      type: "AGENT_QUESTIONS";
      timestamp: string | null;
      questions: MarcusQuestionItem[];
    }
  | {
      type: "CUSTOMER_ANSWERS";
      timestamp: string | null;
      answers: MarcusQuestionItem[];
    }
  | {
      type: "CUSTOMER_QUESTION";
      timestamp: string | null;
      question: CustomerQuestionItem;
    }
  | {
      type: "AWAITING";
      timestamp: null;
    };

const STATUS_ORDER = [
  "new",
  "questions_sent",
  "answers_received",
  "research_in_progress",
  "report_sent",
  "decision_made",
  "unresponsive",
  "paused",
  "cleared",
  "lost",
];

const LOST_REASONS = [
  "Price too high",
  "Customer went elsewhere",
  "Could not source vehicle",
  "Customer went silent",
  "Other",
];

const EMAIL_TYPE_LABELS: Record<string, string> = {
  email_1_customer_welcome: "Welcome Email",
  email_1_admin_notification: "Admin Notification",
  email_1_marcus_notification: "Agent Notification",
  email_2_questions_sent: "Questions Sent",
  email_3_answers_received: "Answers Received",
  email_4_report_ready: "Report Ready",
  email_5_customer_approval_next_steps: "Approval & Next Steps",
  manual_reminder: "Manual Reminder",
  customer_followup_question_sent: "Customer Question Alert",
  report_question_sent: "Report Question Alert",
  sequence_A_step_1: "Follow-up A (Step 1)",
  sequence_A_step_2: "Follow-up A (Step 2)",
  sequence_A_step_3: "Follow-up A (Step 3)",
  sequence_B_step_1: "Follow-up B (Step 1)",
  sequence_B_step_2: "Follow-up B (Step 2)",
  sequence_B_step_3: "Follow-up B (Step 3)",
  sequence_C_step_1: "Follow-up C (Step 1)",
  sequence_C_step_2: "Follow-up C (Step 2)",
  sequence_C_step_3: "Follow-up C (Step 3)",
};

const EMAIL_STAGE_ORDER: EmailStage[] = ["Intake", "Questions", "Research", "Decision", "Follow-up"];

const STATUS_BADGE_STYLES: Record<string, string> = {
  new: "bg-orange-400/20 text-orange-300 ring-1 ring-orange-400/40",
  questions_sent: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  answers_received: "bg-orange-400/20 text-orange-300 ring-1 ring-orange-400/40",
  research_in_progress: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  report_sent: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  decision_made: "bg-green-400/20 text-green-300 ring-1 ring-green-400/40",
  cleared: "bg-zinc-400/20 text-zinc-300 ring-1 ring-zinc-400/40",
  lost: "bg-red-950/60 text-red-300 ring-1 ring-red-900",
  paused: "bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/40 italic",
  unresponsive: "bg-[#7a4f00] text-[#ffb347] ring-1 ring-[#7a4f00]",
  archived: "bg-zinc-700/60 text-zinc-200 ring-1 ring-zinc-600",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatEmailTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCurrencyCad(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

function truncate(str: string, max: number) {
  return str?.length > max ? str.substring(0, max) + "..." : str;
}

function getEmailTypeLabel(emailType: string | null | undefined) {
  if (!emailType) {
    return "Unknown Email";
  }

  return EMAIL_TYPE_LABELS[emailType] ?? emailType;
}

function getEmailStage(emailType: string | null | undefined): EmailStage {
  if (!emailType) {
    return "Follow-up";
  }

  if (emailType.startsWith("email_1_")) {
    return "Intake";
  }
  if (
    emailType.startsWith("email_2_") ||
    emailType.startsWith("email_3_") ||
    emailType === "customer_followup_question_sent"
  ) {
    return "Questions";
  }
  if (emailType.startsWith("email_4_")) {
    return "Research";
  }
  if (emailType.startsWith("email_5_")) {
    return "Decision";
  }

  return "Follow-up";
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getDocketCustomerFirstName(docket: NormalizedAdminDocket) {
  const possibleDocket = docket as NormalizedAdminDocket & { customerFirstName?: string | null };
  return (possibleDocket.customer_first_name ?? possibleDocket.customerFirstName)?.trim() ?? "";
}

function getEmailRecipientLabel(docket: NormalizedAdminDocket, recipientEmail: string | null | undefined) {
  const normalized = normalizeEmail(recipientEmail);

  if (!normalized) {
    return "N/A";
  }

  if (normalized === "adam@jdmrushimports.ca") {
    return "Adam (Admin)";
  }

  if (normalized === "marcus@gemmytrading.com" || normalized === "trade@gemmytrading.com") {
    return "Marcus (Agent)";
  }

  const customerFirstName = getDocketCustomerFirstName(docket);
  if (customerFirstName) {
    return `${customerFirstName} (Customer)`;
  }

  return recipientEmail ?? "N/A";
}

function getEmailBodySnippet(bodySnapshot: string | null | undefined) {
  if (!bodySnapshot) {
    return "No body snapshot available.";
  }

  const plainText = bodySnapshot
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return truncate(plainText, 200);
}

function isPaused(docket: NormalizedAdminDocket) {
  return docket.is_paused || docket.status === "paused";
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

function getDaysInStatus(docket: NormalizedAdminDocket) {
  const since = docket.docket_status_history[0]?.created_at ?? docket.created_at;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days >= 0 ? days : 0;
}

function getAgentStatus(docket: NormalizedAdminDocket) {
  if (docket.status === "new" || docket.status === "answers_received") {
    return "Pending Agent";
  }
  if (docket.status === "cleared" || docket.status === "lost") {
    return "Complete";
  }
  if (isPaused(docket)) {
    return "Paused";
  }
  if (Array.isArray(docket.auction_research) && docket.auction_research.length > 0) {
    return "Research Submitted";
  }
  return "In Progress";
}

function getReminderCount(docket: NormalizedAdminDocket) {
  return docket.email_log.filter((entry) => entry.email_type === "manual_reminder").length;
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
  const [scrollToQuestionsOnOpen, setScrollToQuestionsOnOpen] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [expandedEmailLogIds, setExpandedEmailLogIds] = useState<Set<string>>(new Set());
  const customerQaRef = useRef<HTMLElement | null>(null);

  const [statusDraft, setStatusDraft] = useState("new");
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [estimatedDealValueDraft, setEstimatedDealValueDraft] = useState("");
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [pauseDraft, setPauseDraft] = useState(false);
  const [pausedUntilDraft, setPausedUntilDraft] = useState("");
  const [notesSavedState, setNotesSavedState] = useState<"idle" | "saving" | "saved">("idle");

  const selectedDocket = useMemo(
    () => dockets.find((docket) => docket.id === selectedDocketId) ?? null,
    [dockets, selectedDocketId]
  );

  const customerCommunicationTimeline = useMemo<CustomerCommunicationTimelineEntry[]>(() => {
    if (!selectedDocket) {
      return [];
    }

    const agentQuestionBatches = new Map<string, MarcusQuestionItem[]>();
    for (const question of selectedDocket.marcus_questions) {
      const timestamp = question.created_at ?? "";
      const batch = agentQuestionBatches.get(timestamp) ?? [];
      batch.push(question);
      agentQuestionBatches.set(timestamp, batch);
    }

    const customerAnswerBatches = new Map<string, MarcusQuestionItem[]>();
    for (const question of selectedDocket.marcus_questions) {
      if (!question.answer_text || question.answer_text.trim().length === 0) {
        continue;
      }

      const timestamp = question.answered_at ?? "";
      const batch = customerAnswerBatches.get(timestamp) ?? [];
      batch.push(question);
      customerAnswerBatches.set(timestamp, batch);
    }

    const entries: CustomerCommunicationTimelineEntry[] = [
      ...Array.from(agentQuestionBatches.entries()).map(
        ([timestamp, questions]): CustomerCommunicationTimelineEntry => ({
          type: "AGENT_QUESTIONS",
          timestamp: timestamp || null,
          questions,
        })
      ),
      ...Array.from(customerAnswerBatches.entries()).map(
        ([timestamp, answers]): CustomerCommunicationTimelineEntry => ({
          type: "CUSTOMER_ANSWERS",
          timestamp: timestamp || null,
          answers,
        })
      ),
      ...selectedDocket.customer_questions.map(
        (question): CustomerCommunicationTimelineEntry => ({
          type: "CUSTOMER_QUESTION",
          timestamp: question.created_at,
          question,
        })
      ),
    ];

    const unansweredQuestionsCount =
      selectedDocket.marcus_questions.length -
      selectedDocket.marcus_questions.filter(
        (question) => question.answer_text && question.answer_text.trim().length > 0
      ).length;

    if (selectedDocket.marcus_questions.length > 0 && unansweredQuestionsCount > 0) {
      entries.push({ type: "AWAITING", timestamp: null });
    }

    return entries.sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

      return leftTime - rightTime;
    });
  }, [selectedDocket]);

  const groupedEmailLog = useMemo(() => {
    if (!selectedDocket) {
      return [];
    }

    return EMAIL_STAGE_ORDER.map((stage) => {
      const emails = selectedDocket.email_log
        .filter((entry) => getEmailStage(entry.email_type) === stage)
        .sort((a, b) => new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime());

      return { stage, emails };
    }).filter((group) => group.emails.length > 0);
  }, [selectedDocket]);

  useEffect(() => {
    if (!selectedDocket) {
      return;
    }

    setStatusDraft(selectedDocket.status ?? "new");
    setLostReasonDraft(selectedDocket.lost_reason ?? "");
    setEstimatedDealValueDraft(
      typeof selectedDocket.estimated_deal_value === "number" ? String(selectedDocket.estimated_deal_value) : ""
    );
    setAdminNotesDraft(selectedDocket.admin_notes ?? "");
    setPauseDraft(Boolean(selectedDocket.is_paused || selectedDocket.status === "paused"));
    setPausedUntilDraft(selectedDocket.paused_until ? selectedDocket.paused_until.slice(0, 10) : "");
    setNotesSavedState("idle");
  }, [selectedDocket]);

  useEffect(() => {
    if (!selectedDocket || !scrollToQuestionsOnOpen) {
      return;
    }

    if (selectedDocket.status !== "answers_received") {
      setScrollToQuestionsOnOpen(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      customerQaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToQuestionsOnOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [selectedDocket, scrollToQuestionsOnOpen]);

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
    setExpandedEmailLogIds(new Set());
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

  async function handleToggleFlag(id: string, currentValue: boolean | null) {
    try {
      await patchDocket(id, { is_flagged: !currentValue });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to toggle flag");
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

  function handleOpenDrawer(docketId: string, options?: { scrollToQuestions?: boolean }) {
    setSelectedDocketId(docketId);
    setScrollToQuestionsOnOpen(Boolean(options?.scrollToQuestions));
  }

  function toggleEmailLogEntry(entryId: string) {
    setExpandedEmailLogIds((previous) => {
      const next = new Set(previous);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  async function saveStatus() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { status: statusDraft });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save status");
    }
  }

  async function saveEstimatedDealValue() {
    if (!selectedDocket) {
      return;
    }

    const value = estimatedDealValueDraft.trim();
    const parsed = value.length === 0 ? null : Number(value);

    if (value.length > 0 && Number.isNaN(parsed)) {
      setError("Estimated deal value must be a number");
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { estimated_deal_value: parsed });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save estimated deal value");
    }
  }

  async function savePauseSettings() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, {
        is_paused: pauseDraft,
        paused_until: pauseDraft && pausedUntilDraft ? `${pausedUntilDraft}T00:00:00.000Z` : null,
        status: pauseDraft ? "paused" : statusDraft === "paused" ? "new" : statusDraft,
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save pause settings");
    }
  }

  async function saveLostReason() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { lost_reason: lostReasonDraft || null });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save lost reason");
    }
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
      setNotesSavedState("saved");
    } catch (updateError) {
      setNotesSavedState("idle");
      setError(updateError instanceof Error ? updateError.message : "Failed to save admin notes");
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
    const totalPipelineValue = dockets.reduce(
      (sum, docket) => sum + (typeof docket.estimated_deal_value === "number" ? docket.estimated_deal_value : 0),
      0
    );

    return {
      active,
      needsAttention,
      approvedPending,
      totalPipelineValue,
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

    return filtered.sort((a, b) => {
      const aPaused = isPaused(a);
      const bPaused = isPaused(b);

      if (aPaused !== bPaused) {
        return aPaused ? 1 : -1;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
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
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
              <p className="text-xs uppercase tracking-wider text-white/60">Total Pipeline Value</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrencyCad(metrics.totalPipelineValue)}</p>
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

        <section className="overflow-x-auto rounded-xl border border-white/10 bg-[#131313]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
              <tr>
                <th className="px-3 py-3">Flag</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="min-w-[150px] px-3 py-3">Status</th>
                <th className="px-3 py-3">Days in status</th>
                <th className="px-3 py-3">Reminders sent</th>
                <th className="px-3 py-3">Est. deal value</th>
                <th className="px-3 py-3">AGENT STATUS</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDockets.map((docket) => {
                const status = docket.status ?? "new";
                const badgeClass = STATUS_BADGE_STYLES[status] ?? "bg-zinc-700 text-zinc-100";
                const pausedRow = isPaused(docket);
                const reminderCount = getReminderCount(docket);

                return (
                  <tr
                    key={docket.id}
                    className={`border-t border-white/5 align-top ${pausedRow ? "opacity-50" : "opacity-100"}`}
                  >
                    <td className="px-3 py-3">
                      <button
                        className="text-lg"
                        onClick={() => void handleToggleFlag(docket.id, docket.is_flagged)}
                        type="button"
                      >
                        {docket.is_flagged ? "🚩" : "⚐"}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium">{getCustomerName(docket)}</td>
                    <td className="px-3 py-3 text-white/85">
                      {truncate(docket.vehicle_description || docket.vehicle_make || "", 40) || "N/A"}
                    </td>
                    <td className="min-w-[150px] px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                        {formatStatus(docket.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-white/80">{getDaysInStatus(docket)}</td>
                    <td className="px-3 py-3 text-white/80">{reminderCount}</td>
                    <td className="px-3 py-3 text-white/85">{formatCurrencyCad(docket.estimated_deal_value)}</td>
                    <td className="px-3 py-3 text-white/80">{getAgentStatus(docket)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {status === "questions_sent" ||
                        status === "research_in_progress" ||
                        status === "report_sent" ||
                        status === "decision_made" ? (
                          <button
                            className="rounded-md border border-[#E55125]/70 px-2 py-1 text-xs text-[#E55125] hover:bg-[#E55125]/10"
                            disabled={sendingReminderId === docket.id}
                            onClick={() => void handleSendReminder(docket.id)}
                            type="button"
                          >
                            {sendingReminderId === docket.id ? "Sending..." : "Send Reminder"}
                          </button>
                        ) : null}
                        {status === "answers_received" ? (
                          <button
                            className="rounded-md border border-orange-400/80 px-2 py-1 text-xs text-orange-300 hover:bg-orange-400/10"
                            onClick={() => handleOpenDrawer(docket.id, { scrollToQuestions: true })}
                            type="button"
                          >
                            View Answers
                          </button>
                        ) : null}
                        <button
                          className="rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
                          onClick={() => handleOpenDrawer(docket.id)}
                          type="button"
                        >
                          View
                        </button>
                        {showArchived ? (
                          <button
                            className="rounded-md border border-orange-400/60 px-2 py-1 text-xs text-orange-300 hover:bg-orange-400/10"
                            onClick={() => void handleUnarchiveDocket(docket.id)}
                            type="button"
                          >
                            Unarchive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredDockets.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/60">No dockets match your filters.</div>
          ) : null}
        </section>

        {loading ? <p className="mt-3 text-sm text-white/60">Refreshing dockets...</p> : null}
      </div>

      {selectedDocket ? (
        <div className="fixed inset-0 z-30 bg-black/55" onClick={() => setSelectedDocketId(null)}>
          <aside
            className="absolute inset-y-0 right-0 w-full max-w-[480px] overflow-y-auto border-l border-white/10 bg-[#111111] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{getCustomerName(selectedDocket)}</h2>
                <p className="text-sm text-white/65">{getVehicleLabel(selectedDocket)}</p>
              </div>
              <button
                className="rounded-md border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => setSelectedDocketId(null)}
                type="button"
              >
                X
              </button>
            </div>

            <section className="space-y-2 border-b border-white/10 pb-4 text-sm">
              <p><span className="text-white/60">Email:</span> {selectedDocket.customer_email || "N/A"}</p>
              <p><span className="text-white/60">Phone:</span> {selectedDocket.customer_phone || "N/A"}</p>
              <p>
                <span className="text-white/60">Location:</span>{" "}
                {[selectedDocket.destination_city, selectedDocket.destination_province].filter(Boolean).join(", ") || "N/A"}
              </p>
              <p><span className="text-white/60">Vehicle:</span> {getVehicleLabel(selectedDocket)}</p>
              {selectedDocket.vehicle_description?.trim() ? (
                <p>
                  <span className="text-white/60">Customer&apos;s Vehicle Request:</span> {selectedDocket.vehicle_description}
                </p>
              ) : null}
              {selectedDocket.report_url_token ? (
                <p>
                  <span className="text-white/60">Customer Report:</span>{" "}
                  <a
                    className="font-medium text-[#E55125] underline-offset-4 hover:underline"
                    href={`https://docket.jdmrushimports.ca/report/${selectedDocket.report_url_token}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Customer Report
                  </a>
                </p>
              ) : null}
              {selectedDocket.questions_url_token ? (
                <p>
                  <span className="text-white/60">Customer Questions:</span>{" "}
                  <a
                    className="font-medium text-[#E55125] underline-offset-4 hover:underline"
                    href={`https://docket.jdmrushimports.ca/questions/${selectedDocket.questions_url_token}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Customer Questions
                  </a>
                </p>
              ) : null}
            </section>

            <section className="mt-4 space-y-3 border-b border-white/10 pb-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Status override
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void saveStatus()}
                  type="button"
                >
                  Save
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Estimated deal value (CAD)
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    value={estimatedDealValueDraft}
                    onChange={(event) => setEstimatedDealValueDraft(event.target.value)}
                  />
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void saveEstimatedDealValue()}
                  type="button"
                >
                  Save
                </button>
              </div>

              <label className="block text-xs uppercase tracking-wider text-white/60">
                Admin notes
                <textarea
                  className="mt-1 min-h-[110px] w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
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
              <p className="text-xs text-white/60">
                {notesSavedState === "saving" ? "Saving..." : notesSavedState === "saved" ? "Saved ✓" : ""}
              </p>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-black/30 px-3 text-sm">
                  <input
                    checked={pauseDraft}
                    onChange={(event) => setPauseDraft(event.target.checked)}
                    type="checkbox"
                  />
                  Pause docket
                </label>
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Paused until
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    disabled={!pauseDraft}
                    type="date"
                    value={pausedUntilDraft}
                    onChange={(event) => setPausedUntilDraft(event.target.value)}
                  />
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void savePauseSettings()}
                  type="button"
                >
                  Save
                </button>
              </div>

              {statusDraft === "lost" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Lost reason
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                      onChange={(event) => setLostReasonDraft(event.target.value)}
                      value={lostReasonDraft}
                    >
                      <option value="">Select reason</option>
                      {LOST_REASONS.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                    onClick={() => void saveLostReason()}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </section>

            <section className="mt-4 border-b border-white/10 pb-4">
              <p className="text-sm text-white/70">
                Reminder count: {getReminderCount(selectedDocket)}
              </p>
              <button
                className="mt-2 rounded-md border border-[#E55125]/70 px-3 py-2 text-sm text-[#E55125] hover:bg-[#E55125]/10"
                disabled={sendingReminderId === selectedDocket.id}
                onClick={() => void handleSendReminder(selectedDocket.id)}
                type="button"
              >
                {sendingReminderId === selectedDocket.id ? "Sending..." : "Send Reminder"}
              </button>
            </section>

            <section className="mt-4 border-b border-white/10 pb-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">Status history</h3>
              <div className="space-y-2 text-sm">
                {selectedDocket.docket_status_history.length === 0 ? <p className="text-white/50">No status history.</p> : null}
                {selectedDocket.docket_status_history.map((entry) => (
                  <div className="rounded-md border border-white/10 bg-black/25 p-2" key={entry.id}>
                    <p className="text-white/85">
                      {(entry.old_status ?? "none")} → {(entry.new_status ?? "none")}
                    </p>
                    <p className="text-xs text-white/60">
                      {entry.changed_by ?? "system"} • {formatDate(entry.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 border-b border-white/10 pb-4" ref={customerQaRef}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">Customer Communication</h3>
              <div className="space-y-3 text-sm">
                {customerCommunicationTimeline.length === 0 ? (
                  <p className="text-white/50">No customer communication yet.</p>
                ) : null}
                {customerCommunicationTimeline.map((entry) => {
                  if (entry.type === "AGENT_QUESTIONS") {
                    return (
                      <article
                        className="rounded-md border border-white/10 border-l-4 border-l-[#E55125] bg-black/25 p-3"
                        key={`agent-questions-${entry.timestamp ?? "unknown"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h4 className="font-medium text-white">
                            <span aria-hidden="true" className="mr-2">
                              📤
                            </span>
                            Agent sent {entry.questions.length}{" "}
                            {entry.questions.length === 1 ? "question" : "questions"}
                          </h4>
                          <span className="text-xs text-white/50">{formatDate(entry.timestamp)}</span>
                        </div>
                        <ol className="mt-3 list-decimal space-y-2 pl-5 text-white/85">
                          {entry.questions.map((question) => (
                            <li key={question.id}>{question.question_text || "Untitled question"}</li>
                          ))}
                        </ol>
                      </article>
                    );
                  }

                  if (entry.type === "CUSTOMER_ANSWERS") {
                    return (
                      <article
                        className="rounded-md border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-3"
                        key={`customer-answers-${entry.timestamp ?? "unknown"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h4 className="font-medium text-white">
                            <span aria-hidden="true" className="mr-2">
                              📥
                            </span>
                            Customer answered
                          </h4>
                          <span className="text-xs text-white/50">{formatDate(entry.timestamp)}</span>
                        </div>
                        {entry.answers.length > 1 ? (
                          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[#E55125]">
                            {entry.answers.map((question) => (
                              <li key={question.id}>{question.answer_text || "No answer provided."}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-3 text-[#E55125]">
                            {entry.answers[0]?.answer_text || "No answer provided."}
                          </p>
                        )}
                      </article>
                    );
                  }

                  if (entry.type === "CUSTOMER_QUESTION") {
                    return (
                      <article
                        className="rounded-md border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-3"
                        key={`customer-question-${entry.question.id}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h4 className="font-medium text-white">
                            <span aria-hidden="true" className="mr-2">
                              💬
                            </span>
                            Customer asked
                          </h4>
                          <span className="text-xs text-white/50">{formatDate(entry.timestamp)}</span>
                        </div>
                        <p className="mt-3 text-white/85">{entry.question.question_text || "Untitled question"}</p>
                      </article>
                    );
                  }

                  return (
                    <article
                      className="rounded-md border border-white/10 border-l-4 border-l-white/20 bg-black/25 p-3"
                      key="awaiting-customer-response"
                    >
                      <h4 className="font-medium text-white/50">
                        <span aria-hidden="true" className="mr-2">
                          ⏳
                        </span>
                        Awaiting customer response
                      </h4>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">Email log</h3>
              <div className="space-y-4 text-sm">
                {selectedDocket.email_log.length === 0 ? <p className="text-white/50">No emails logged.</p> : null}
                {groupedEmailLog.map((group) => (
                  <div className="space-y-2" key={group.stage}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white/45">{group.stage}</h4>
                    {group.emails.map((entry) => {
                      const isExpanded = expandedEmailLogIds.has(entry.id);
                      const hasError = Boolean(entry.error);

                      return (
                        <article className="rounded-md border border-white/10 bg-black/25" key={entry.id}>
                          <button
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)_6.75rem] items-center gap-3 px-3 py-2 text-left transition hover:bg-white/5"
                            onClick={() => toggleEmailLogEntry(entry.id)}
                            type="button"
                          >
                            <span
                              aria-label={hasError ? "Email error" : "Email sent"}
                              className={`h-2.5 w-2.5 rounded-full ${
                                hasError ? "bg-red-400" : "bg-emerald-400"
                              }`}
                            />
                            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="min-w-0 truncate text-white/85">{getEmailTypeLabel(entry.email_type)}</span>
                              <span className="break-words text-white/60">
                                {getEmailRecipientLabel(selectedDocket, entry.recipient_email)}
                              </span>
                            </span>
                            <span className="justify-self-end whitespace-nowrap text-right text-xs text-white/50">
                              {formatEmailTimestamp(entry.sent_at)}
                            </span>
                          </button>

                          {isExpanded ? (
                            <div className="border-t border-white/10 px-3 py-3 text-xs">
                              <p className="font-medium text-white/80">{entry.subject || "(No subject)"}</p>
                              <p className="mt-2 leading-relaxed text-white/55">
                                {getEmailBodySnippet(entry.body_snapshot)}
                              </p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
            {!showArchived ? (
              <section className="mt-6 border-t border-white/10 pt-4">
                <button
                  className="w-full rounded-md border border-[#E55125] bg-[#E55125] px-4 py-3 text-base font-bold text-white hover:bg-[#cf4a22]"
                  onClick={() => void handleArchiveSelectedDocket()}
                  type="button"
                >
                  Archive
                </button>
              </section>
            ) : (
              <section className="mt-6 border-t border-white/10 pt-4">
                <button
                  className="w-full rounded-md border border-[#E55125] bg-[#E55125] px-4 py-3 text-lg font-bold text-white hover:bg-[#cf4a22]"
                  onClick={() => void handleUnarchiveDocket(selectedDocket.id)}
                  type="button"
                >
                  Unarchive
                </button>
              </section>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}

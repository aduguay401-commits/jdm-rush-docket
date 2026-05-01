export type DashboardDocketStatusHistoryItem = {
  old_status: string | null;
  new_status: string | null;
  changed_at?: string | null;
  created_at?: string | null;
};

export type DashboardMarcusQuestionItem = {
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string | null;
};

export type DashboardCustomerQuestionItem = {
  question_text: string | null;
  created_at: string | null;
};

export type DashboardEmailLogItem = {
  email_type: string | null;
  subject: string | null;
  body_snapshot?: string | null;
  sent_at: string | null;
};

export type DashboardDisplayDocket = {
  id: string;
  created_at: string;
  status: string | null;
  docket_status_history?: DashboardDocketStatusHistoryItem[] | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  marcus_questions?: DashboardMarcusQuestionItem[] | null;
  customer_questions?: DashboardCustomerQuestionItem[] | null;
  email_log?: DashboardEmailLogItem[] | null;
};

export type LatestActivityType = "customer_question" | "customer_answer" | "agent_question" | "agent_email" | "system_email";
export type LatestActivitySender = "agent" | "customer";

export type LatestActivity = {
  type: LatestActivityType;
  sender: LatestActivitySender;
  timestamp: string;
  subject: string | null;
  snippet: string | null;
  directionLabel: string;
  source_type: LatestActivityType;
  direction: LatestActivitySender;
};

export type StatusDisplay = {
  text: string;
  className: string;
  stripeColor: string;
};

export type ProgressBarStageState = {
  currentIndex: number;
  completedStages: number[];
  isDimmedCurrent: boolean;
  status: string;
  currentStageClassName: string;
  completedStageClassName: string;
  futureStageClassName: string;
  completedLineClassName: string;
  futureLineClassName: string;
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

const ACTION_STRIPE_COLOR = "#4ade80";
const WAITING_STRIPE_COLOR = "rgba(168,162,158,0.5)";

const CLOSED_STATUS_PRIORITY: Record<string, number> = {
  cleared: 0,
  unresponsive: 1,
  lost: 2,
  paused: 2,
};

function formatStatus(status: string | null | undefined) {
  const normalized = status ?? "new";
  return STATUS_LABELS[normalized] ?? normalized;
}

function truncateSnippet(value: string | null | undefined, maxLength = 100) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}...` : normalized;
}

function getCustomerFacingEmailCommunication(
  email: DashboardEmailLogItem
): Pick<LatestActivity, "directionLabel" | "snippet" | "subject"> | null {
  const emailType = email.email_type;

  if (!emailType) {
    return null;
  }

  const labelsByType: Record<string, Pick<LatestActivity, "directionLabel" | "snippet" | "subject">> = {
    email_1_customer_welcome: {
      directionLabel: "📤 Welcome email sent",
      subject: email.subject ?? null,
      snippet: "Welcome email sent to customer",
    },
    email_2_questions_sent: {
      directionLabel: "📤 Questions sent",
      subject: email.subject ?? null,
      snippet: truncateSnippet(email.subject) ?? "Research questions sent to customer",
    },
    email_4_report_ready: {
      directionLabel: "📤 Report sent",
      subject: email.subject ?? null,
      snippet: "Full research report sent to customer",
    },
    email_5_customer_approval_next_steps: {
      directionLabel: "📤 Approval next steps sent",
      subject: email.subject ?? null,
      snippet: "Deposit and agreement instructions sent",
    },
    manual_reminder: {
      directionLabel: "📤 Manual reminder sent",
      subject: email.subject ?? null,
      snippet: "Status reminder sent to customer",
    },
  };

  if (labelsByType[emailType]) {
    return labelsByType[emailType];
  }

  const sequenceMatch = /^sequence_([ABC])_step_([123])$/.exec(emailType);
  if (!sequenceMatch) {
    return null;
  }

  const [, sequenceType, step] = sequenceMatch;

  if (sequenceType === "A") {
    return {
      directionLabel: `📤 Follow-up #${step} sent`,
      subject: email.subject ?? null,
      snippet: "Questions follow-up sent to customer",
    };
  }

  if (sequenceType === "B") {
    return {
      directionLabel: `📤 Report follow-up #${step} sent`,
      subject: email.subject ?? null,
      snippet: "Report follow-up sent to customer",
    };
  }

  return {
    directionLabel: `📤 Approval follow-up #${step} sent`,
    subject: email.subject ?? null,
    snippet: "Approval follow-up sent to customer",
  };
}

export function getLatestActivity(docket: DashboardDisplayDocket): LatestActivity | null {
  const customerFirstName = docket.customer_first_name?.trim() || "Customer";
  type LatestActivityCandidate = LatestActivity & {
    email_type?: string | null;
  };

  const candidates: LatestActivityCandidate[] = [];

  for (const question of docket.marcus_questions ?? []) {
    if (question.question_text?.trim() && question.created_at) {
      candidates.push({
        direction: "agent",
        sender: "agent",
        source_type: "agent_question",
        type: "agent_question",
        directionLabel: "📤 You",
        subject: null,
        snippet: truncateSnippet(question.question_text),
        timestamp: question.created_at,
      });
    }

    if (question.answer_text?.trim() && question.answered_at) {
      candidates.push({
        direction: "customer",
        sender: "customer",
        source_type: "customer_answer",
        type: "customer_answer",
        directionLabel: `📥 ${customerFirstName}`,
        subject: null,
        snippet: truncateSnippet(question.answer_text),
        timestamp: question.answered_at,
      });
    }
  }

  for (const question of docket.customer_questions ?? []) {
    if (question.question_text?.trim() && question.created_at) {
      candidates.push({
        direction: "customer",
        sender: "customer",
        source_type: "customer_question",
        type: "customer_question",
        directionLabel: `📥 ${customerFirstName}`,
        subject: null,
        snippet: truncateSnippet(question.question_text),
        timestamp: question.created_at,
      });
    }
  }

  for (const email of docket.email_log ?? []) {
    if (email.sent_at) {
      const emailCommunication = getCustomerFacingEmailCommunication(email);

      if (!emailCommunication) {
        continue;
      }

      candidates.push({
        direction: "agent",
        sender: "agent",
        source_type: "agent_email",
        type: "agent_email",
        email_type: email.email_type,
        directionLabel: emailCommunication.directionLabel,
        subject: emailCommunication.subject,
        snippet: emailCommunication.snippet,
        timestamp: email.sent_at,
      });
    }
  }

  const dedupedCandidates = candidates.filter((candidate) => {
    if (candidate.source_type !== "agent_email") {
      return true;
    }

    const isPairedAgentQuestionEmail = candidate.email_type === "email_2_questions_sent";
    const isPairedCustomerQuestionEmail =
      candidate.email_type?.startsWith("customer_followup_question_sent") ||
      candidate.email_type?.startsWith("report_question_sent");

    if (!isPairedAgentQuestionEmail && !isPairedCustomerQuestionEmail) {
      return true;
    }

    const pairedSourceType = isPairedAgentQuestionEmail ? "agent_question" : "customer_question";
    const emailTime = new Date(candidate.timestamp).getTime();

    return !candidates.some((otherCandidate) => {
      if (otherCandidate.source_type !== pairedSourceType) {
        return false;
      }

      const otherTime = new Date(otherCandidate.timestamp).getTime();
      return Math.abs(emailTime - otherTime) < 60_000;
    });
  });

  return dedupedCandidates.reduce<LatestActivity | null>((latest, candidate) => {
    if (!latest) {
      return candidate;
    }

    return new Date(candidate.timestamp).getTime() > new Date(latest.timestamp).getTime() ? candidate : latest;
  }, null);
}

export function getStripeColor(status: string | null | undefined) {
  return STATUS_STRIPE_COLORS[status ?? "new"] ?? WAITING_STRIPE_COLOR;
}

function isOutboundCommunication(sourceType: LatestActivity["source_type"] | undefined) {
  return sourceType === "agent_question" || sourceType === "agent_email" || sourceType === "system_email";
}

export function getStatusDisplay(
  docket: DashboardDisplayDocket,
  latestActivity: LatestActivity | null = getLatestActivity(docket)
): StatusDisplay {
  const normalizedStatus = docket.status ?? "new";
  const defaultStatusLine = STATUS_LINE_CONTENT[normalizedStatus] ?? {
    text: formatStatus(normalizedStatus),
    className: "font-normal text-[#888]",
  };

  if (normalizedStatus === "report_sent" || normalizedStatus === "research_in_progress") {
    if (latestActivity?.source_type === "customer_question") {
      return {
        text: "🏎️ Customer asked a question — respond",
        className: "font-semibold text-[#4ade80]",
        stripeColor: ACTION_STRIPE_COLOR,
      };
    }

    return {
      ...defaultStatusLine,
      stripeColor: getStripeColor(normalizedStatus),
    };
  }

  if (normalizedStatus === "questions_sent") {
    if (latestActivity?.source_type === "customer_question") {
      return {
        text: "🏎️ Customer asked a question — respond",
        className: "font-semibold text-[#4ade80]",
        stripeColor: ACTION_STRIPE_COLOR,
      };
    }

    if (latestActivity?.source_type === "customer_answer") {
      return {
        text: "🏎️ Customer answered — respond or pull research",
        className: "font-semibold text-[#4ade80]",
        stripeColor: ACTION_STRIPE_COLOR,
      };
    }
  }

  if (normalizedStatus === "answers_received") {
    if (latestActivity?.source_type === "customer_question") {
      return {
        text: "🏎️ Customer asked a question — respond",
        className: "font-semibold text-[#4ade80]",
        stripeColor: ACTION_STRIPE_COLOR,
      };
    }

    if (latestActivity?.source_type === "customer_answer") {
      return {
        ...defaultStatusLine,
        stripeColor: getStripeColor(normalizedStatus),
      };
    }

    if (isOutboundCommunication(latestActivity?.source_type)) {
      return {
        text: "⏳ Follow-up sent. Awaiting customer response.",
        className: "font-normal text-[#aaa]",
        stripeColor: WAITING_STRIPE_COLOR,
      };
    }
  }

  return {
    ...defaultStatusLine,
    stripeColor: getStripeColor(normalizedStatus),
  };
}

function getStatusHistoryTimestamp(item: DashboardDocketStatusHistoryItem) {
  return item.changed_at ?? item.created_at ?? null;
}

function sortStatusHistory(history: DashboardDocketStatusHistoryItem[] | null | undefined) {
  return Array.isArray(history)
    ? [...history].sort((a, b) => {
        const aTime = new Date(getStatusHistoryTimestamp(a) ?? 0).getTime();
        const bTime = new Date(getStatusHistoryTimestamp(b) ?? 0).getTime();
        return bTime - aTime;
      })
    : [];
}

function findPreviousPipelineStage(status: string, history: DashboardDocketStatusHistoryItem[] | null | undefined) {
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

export function getProgressBarStage(status: string | null | undefined, docket?: DashboardDisplayDocket): ProgressBarStageState {
  const normalizedStatus = status ?? "new";
  const currentIndex =
    normalizedStatus in PROGRESS_STAGE_INDEX_BY_STATUS
      ? PROGRESS_STAGE_INDEX_BY_STATUS[normalizedStatus]
      : DIMMED_STATUS_SET.has(normalizedStatus)
        ? findPreviousPipelineStage(normalizedStatus, docket?.docket_status_history)
        : 0;
  const isDimmedCurrent = !(normalizedStatus in PROGRESS_STAGE_INDEX_BY_STATUS) && DIMMED_STATUS_SET.has(normalizedStatus);

  return {
    currentIndex,
    completedStages: Array.from({ length: currentIndex }, (_, index) => index),
    isDimmedCurrent,
    status: normalizedStatus,
    currentStageClassName: isDimmedCurrent
      ? "border-zinc-500 bg-zinc-600"
      : (CURRENT_STAGE_STYLES[normalizedStatus] ?? "border-white/50 bg-white/60"),
    completedStageClassName: "border-white bg-white",
    futureStageClassName: "border-zinc-700 bg-zinc-800",
    completedLineClassName: "bg-white/65",
    futureLineClassName: "bg-zinc-800",
  };
}

type DocketWithLatestActivity = {
  docket: DashboardDisplayDocket;
  latestActivity: LatestActivity | null;
};

function getDocketUrgencyPriority({ docket, latestActivity }: DocketWithLatestActivity) {
  const status = docket.status ?? "new";
  const sourceType = latestActivity?.source_type;

  if (sourceType === "customer_question") {
    return 0;
  }

  if (status === "answers_received" && sourceType === "customer_answer") {
    return 1;
  }

  if (status === "new") {
    return 2;
  }

  if (status === "research_in_progress") {
    return 3;
  }

  if (status === "decision_made") {
    return 4;
  }

  if (status === "questions_sent" || status === "report_sent" || status === "answers_received") {
    return 5;
  }

  if (status in CLOSED_STATUS_PRIORITY) {
    return 6;
  }

  return 6;
}

function getDocketSortTimestamp({ docket, latestActivity }: DocketWithLatestActivity) {
  const timestamp = latestActivity?.timestamp ?? docket.created_at;
  const time = new Date(timestamp).getTime();

  return Number.isFinite(time) ? time : 0;
}

function compareDocketsByUrgency(a: DocketWithLatestActivity, b: DocketWithLatestActivity) {
  const aPriority = getDocketUrgencyPriority(a);
  const bPriority = getDocketUrgencyPriority(b);

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  if (aPriority === 6) {
    const aStatusPriority = CLOSED_STATUS_PRIORITY[a.docket.status ?? ""] ?? Number.MAX_SAFE_INTEGER;
    const bStatusPriority = CLOSED_STATUS_PRIORITY[b.docket.status ?? ""] ?? Number.MAX_SAFE_INTEGER;

    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority;
    }
  }

  return getDocketSortTimestamp(b) - getDocketSortTimestamp(a);
}

export function sortDocketsByUrgency<TDocket extends DashboardDisplayDocket>(dockets: TDocket[]) {
  return dockets
    .map((docket) => ({
      docket,
      latestActivity: getLatestActivity(docket),
    }))
    .sort(compareDocketsByUrgency)
    .map(({ docket }) => docket);
}

/**
 * Builds a newest-first docket activity stream from a docket-like object that may include
 * docket_status_history, email_log, marcus_questions, and customer_questions arrays.
 * Missing or null source arrays are treated as empty, and events with no valid timestamp
 * are skipped because every returned DocketActivityEvent has an ISO timestamp.
 */

export type DocketActivityEventCategory = "email" | "status" | "customer_message" | "agent_message";

export type DocketActivityExpandableContent =
  | {
      type: "questions";
      items: string[];
    }
  | {
      type: "qa_pairs";
      items: { question: string; answer: string }[];
    }
  | {
      type: "message";
      text: string;
    };

export type DocketActivityEvent = {
  id: string;
  timestamp: string;
  category: DocketActivityEventCategory;
  icon: string;
  colorClass: string;
  title: string;
  subtitle?: string;
  expandable_content?: DocketActivityExpandableContent;
};

type ActivityFeedDocket = {
  customer_first_name?: string | null;
  customerFirstName?: string | null;
  docket_status_history?: DocketStatusHistoryInput[] | null;
  email_log?: EmailLogInput[] | null;
  marcus_questions?: MarcusQuestionInput[] | null;
  customer_questions?: CustomerQuestionInput[] | null;
};

type DocketStatusHistoryInput = {
  id?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  changed_by?: string | null;
  changed_at?: string | null;
};

type EmailLogInput = {
  id?: string | null;
  email_type?: string | null;
  recipient_email?: string | null;
  subject?: string | null;
  body_snapshot?: string | null;
  error?: string | null;
  sent_at?: string | null;
};

type MarcusQuestionInput = {
  id?: string | null;
  question_text?: string | null;
  answer_text?: string | null;
  answered_at?: string | null;
  created_at?: string | null;
};

type CustomerQuestionInput = {
  id?: string | null;
  question_text?: string | null;
  answer_text?: string | null;
  answered_at?: string | null;
  created_at?: string | null;
};

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

const INTERNAL_EMAIL_TYPES = new Set([
  "email_1_admin_notification",
  "email_1_marcus_notification",
  "email_4_proceed_to_research",
  "customer_followup_question_sent",
  "report_question_sent",
  "report_decision_sent",
]);

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
  archived: "Archived",
};

const STATUS_TRANSITION_EMAIL_TYPES = new Map<string, string>([
  ["new->questions_sent", "email_2_questions_sent"],
  ["questions_sent->answers_received", "email_3_answers_received"],
  ["research_in_progress->report_sent", "email_4_report_ready"],
  ["report_sent->decision_made", "email_5_customer_approval_next_steps"],
]);

const EMAIL_MATCH_WINDOW_SECONDS = 60;
const QUESTION_BATCH_WINDOW_SECONDS = 5;

function getArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function toIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  const time = timestamp.getTime();

  return Number.isFinite(time) ? timestamp.toISOString() : null;
}

function getTimestampMs(isoTimestamp: string) {
  return new Date(isoTimestamp).getTime();
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getDocketCustomerFirstName(docket: ActivityFeedDocket) {
  return (docket.customer_first_name ?? docket.customerFirstName)?.trim() ?? "";
}

export function getEmailTypeLabel(emailType: string | null | undefined) {
  if (!emailType) {
    return "Unknown Email";
  }

  return EMAIL_TYPE_LABELS[emailType] ?? emailType;
}

export function getEmailRecipientLabel(docket: ActivityFeedDocket, recipientEmail: string | null | undefined) {
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

function getStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "None";
  }

  return STATUS_LABELS[status] ?? status;
}

function getStatusTransitionEmailType(oldStatus: string | null | undefined, newStatus: string | null | undefined) {
  return STATUS_TRANSITION_EMAIL_TYPES.get(`${oldStatus ?? ""}->${newStatus ?? ""}`) ?? null;
}

function addEmailTimestamp(emailTimestampIndex: Map<string, Set<number>>, emailType: string | null | undefined, timestamp: string) {
  if (!emailType) {
    return;
  }

  const second = Math.floor(getTimestampMs(timestamp) / 1000);
  const seconds = emailTimestampIndex.get(emailType) ?? new Set<number>();
  seconds.add(second);
  emailTimestampIndex.set(emailType, seconds);
}

function hasMatchingEmailNearStatus(
  emailTimestampIndex: Map<string, Set<number>>,
  emailType: string,
  statusTimestamp: string
) {
  const seconds = emailTimestampIndex.get(emailType);
  if (!seconds) {
    return false;
  }

  const statusSecond = Math.floor(getTimestampMs(statusTimestamp) / 1000);
  for (let offset = -EMAIL_MATCH_WINDOW_SECONDS; offset <= EMAIL_MATCH_WINDOW_SECONDS; offset += 1) {
    if (seconds.has(statusSecond + offset)) {
      return true;
    }
  }

  return false;
}

function buildEmailTitle(
  docket: ActivityFeedDocket,
  email: EmailLogInput,
  isFirstReportReadyEmail: boolean
) {
  const recipientLabel = getEmailRecipientLabel(docket, email.recipient_email);

  if (email.email_type === "email_4_report_ready") {
    return isFirstReportReadyEmail ? "Report sent to customer" : "Report resent (edited)";
  }

  return `${getEmailTypeLabel(email.email_type)} sent to ${recipientLabel}`;
}

function getEmailEventVisual(emailType: string | null | undefined) {
  if (emailType === "email_1_customer_welcome") {
    return { icon: "👋", colorClass: "text-[#888]" };
  }

  if (emailType === "email_4_report_ready") {
    return { icon: "📄", colorClass: "text-[#E55125]" };
  }

  if (emailType === "manual_reminder") {
    return { icon: "🔔", colorClass: "text-[#f59e0b]" };
  }

  return { icon: "📧", colorClass: "text-[#888]" };
}

function buildEmailEvent(
  docket: ActivityFeedDocket,
  email: EmailLogInput,
  index: number,
  isFirstReportReadyEmail: boolean
): DocketActivityEvent | null {
  if (email.email_type && INTERNAL_EMAIL_TYPES.has(email.email_type)) {
    return null;
  }

  const timestamp = toIsoTimestamp(email.sent_at);
  if (!timestamp) {
    return null;
  }

  const visual = getEmailEventVisual(email.email_type);

  return {
    id: `email:${email.id ?? `${email.email_type ?? "unknown"}:${timestamp}:${index}`}`,
    timestamp,
    category: "email",
    icon: visual.icon,
    colorClass: visual.colorClass,
    title: buildEmailTitle(docket, email, isFirstReportReadyEmail),
    subtitle: email.subject?.trim() || undefined,
    expandable_content: email.body_snapshot?.trim()
      ? { type: "message", text: email.body_snapshot.trim() }
      : undefined,
  };
}

function getFirstReportReadyEmailIndex(emails: EmailLogInput[]) {
  let firstIndex: number | null = null;
  let firstTime = Number.POSITIVE_INFINITY;

  emails.forEach((email, index) => {
    if (email.email_type !== "email_4_report_ready") {
      return;
    }

    const timestamp = toIsoTimestamp(email.sent_at);
    if (!timestamp) {
      return;
    }

    const time = getTimestampMs(timestamp);
    if (time < firstTime) {
      firstTime = time;
      firstIndex = index;
    }
  });

  return firstIndex;
}

type TimestampedQuestion<T> = T & {
  timestamp: string;
  timestampMs: number;
};

function groupByTimestampWindow<T extends object>(
  items: T[],
  getTimestamp: (item: T) => string | null | undefined
): TimestampedQuestion<T>[][] {
  const sorted = items
    .map((item) => {
      const timestamp = toIsoTimestamp(getTimestamp(item));
      if (!timestamp) {
        return null;
      }

      return {
        ...item,
        timestamp,
        timestampMs: getTimestampMs(timestamp),
      };
    })
    .filter((item): item is TimestampedQuestion<T> => item !== null)
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const groups: TimestampedQuestion<T>[][] = [];

  for (const item of sorted) {
    const currentGroup = groups[groups.length - 1];
    const firstGroupItem = currentGroup?.[0];

    if (
      !currentGroup ||
      !firstGroupItem ||
      item.timestampMs - firstGroupItem.timestampMs > QUESTION_BATCH_WINDOW_SECONDS * 1000
    ) {
      groups.push([item]);
      continue;
    }

    currentGroup.push(item);
  }

  return groups;
}

function buildAgentQuestionBatchEvent(
  questions: TimestampedQuestion<MarcusQuestionInput>[],
  index: number
): DocketActivityEvent | null {
  const firstQuestion = questions[0];
  if (!firstQuestion) {
    return null;
  }

  const questionTexts = questions.map((question) => question.question_text?.trim() || "No question provided.");

  return {
    id: `agent_message_batch:${questions.map((question) => question.id ?? question.timestamp).join(":")}:${index}`,
    timestamp: firstQuestion.timestamp,
    category: "agent_message",
    icon: "📤",
    colorClass: "text-[#E55125]",
    title: `Agent sent ${questions.length} ${questions.length === 1 ? "question" : "questions"}`,
    expandable_content: { type: "questions", items: questionTexts },
  };
}

function buildCustomerAnswerBatchEvent(
  questions: TimestampedQuestion<MarcusQuestionInput>[],
  index: number
): DocketActivityEvent | null {
  const firstQuestion = questions[0];
  if (!firstQuestion) {
    return null;
  }

  return {
    id: `customer_answer_batch:${questions.map((question) => question.id ?? question.timestamp).join(":")}:${index}`,
    timestamp: firstQuestion.timestamp,
    category: "customer_message",
    icon: "💬",
    colorClass: "text-[#22c55e]",
    title: `Customer answered ${questions.length} ${questions.length === 1 ? "question" : "questions"}`,
    expandable_content: {
      type: "qa_pairs",
      items: questions.map((question) => ({
        question: question.question_text?.trim() || "No question provided.",
        answer: question.answer_text?.trim() || "No answer provided.",
      })),
    },
  };
}

function buildCustomerQuestionEvent(question: CustomerQuestionInput, index: number): DocketActivityEvent | null {
  const timestamp = toIsoTimestamp(question.created_at);
  if (!timestamp) {
    return null;
  }

  return {
    id: `customer_message:${question.id ?? `${timestamp}:${index}`}`,
    timestamp,
    category: "customer_message",
    icon: "💬",
    colorClass: "text-[#22c55e]",
    title: "Customer asked a question",
    expandable_content: { type: "message", text: question.question_text?.trim() || "No question provided." },
  };
}

function buildStatusEvent(statusHistory: DocketStatusHistoryInput, index: number): DocketActivityEvent | null {
  const timestamp = toIsoTimestamp(statusHistory.changed_at);
  if (!timestamp) {
    return null;
  }

  return {
    id: `status:${statusHistory.id ?? `${statusHistory.old_status ?? "none"}:${statusHistory.new_status ?? "none"}:${timestamp}:${index}`}`,
    timestamp,
    category: "status",
    icon: "🔄",
    colorClass: "text-[#3b82f6]",
    title: `Status changed to ${getStatusLabel(statusHistory.new_status)}`,
    subtitle: `${getStatusLabel(statusHistory.old_status)} → ${getStatusLabel(statusHistory.new_status)}`,
  };
}

export function getDocketActivityFeed(docket: ActivityFeedDocket): DocketActivityEvent[] {
  const events: DocketActivityEvent[] = [];
  const emailTimestampIndex = new Map<string, Set<number>>();
  const emails = getArray(docket.email_log);
  const firstReportReadyEmailIndex = getFirstReportReadyEmailIndex(emails);

  emails.forEach((email, index) => {
    const event = buildEmailEvent(docket, email, index, index === firstReportReadyEmailIndex);
    if (!event) {
      return;
    }

    addEmailTimestamp(emailTimestampIndex, email.email_type, event.timestamp);
    events.push(event);
  });

  groupByTimestampWindow(getArray(docket.marcus_questions), (question) => question.created_at).forEach((questions, index) => {
    const event = buildAgentQuestionBatchEvent(questions, index);
    if (event) {
      events.push(event);
    }
  });

  groupByTimestampWindow(
    getArray(docket.marcus_questions).filter((question) => question.answer_text?.trim()),
    (question) => question.answered_at
  ).forEach((questions, index) => {
    const event = buildCustomerAnswerBatchEvent(questions, index);
    if (event) {
      events.push(event);
    }
  });

  getArray(docket.customer_questions).forEach((question, index) => {
    const event = buildCustomerQuestionEvent(question, index);
    if (event) {
      events.push(event);
    }
  });

  getArray(docket.docket_status_history).forEach((statusHistory, index) => {
    if (statusHistory.old_status === statusHistory.new_status) {
      return;
    }

    const event = buildStatusEvent(statusHistory, index);
    if (!event) {
      return;
    }

    const matchingEmailType = getStatusTransitionEmailType(statusHistory.old_status, statusHistory.new_status);
    if (matchingEmailType && hasMatchingEmailNearStatus(emailTimestampIndex, matchingEmailType, event.timestamp)) {
      return;
    }

    events.push(event);
  });

  return events.sort((left, right) => getTimestampMs(right.timestamp) - getTimestampMs(left.timestamp));
}

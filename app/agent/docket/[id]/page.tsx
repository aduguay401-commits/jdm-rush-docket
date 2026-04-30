"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient, createBrowserSupabaseClientWithAuth } from "@/lib/supabase/client";

type Docket = {
  id: string;
  questions_url_token: string | null;
  report_url_token: string | null;
  status: string | null;
  chosen_path: string | null;
  selected_path: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  budget_bracket: string | null;
  destination_city: string | null;
  destination_province: string | null;
  timeline: string | null;
  additional_notes: string | null;
  research_draft: unknown | null;
};

type AuctionResearchRecord = {
  hammer_price_low_jpy: number | string | null;
  hammer_price_high_jpy: number | string | null;
  recommended_max_bid_jpy: number | string | null;
  sales_history_notes: string | null;
  auction_listings: unknown;
};

type PrivateDealerOptionRecord = {
  option_number: number | null;
  year: string | null;
  make: string | null;
  model: string | null;
  grade: string | null;
  mileage: string | null;
  colour: string | null;
  transmission: string | null;
  trim: string | null;
  dealer_price_jpy: number | string | null;
  dealer_price_cad: number | string | null;
  photos: unknown;
  sales_sheet_url: string | null;
  marcus_notes: string | null;
};

type ReportEmailLog = {
  sent_at: string | null;
};

type CustomerAnswer = {
  id: string;
  question_text: string;
  answer_text: string | null;
  answered_at: string | null;
};

type SentQuestion = {
  id: string;
  question_text: string;
  created_at: string;
};

type CustomerSubmittedQuestion = {
  id: string;
  question_text: string;
  created_at: string | null;
  read_at: string | null;
};

type CommunicationTimelineEntry =
  | {
      type: "AGENT_QUESTIONS";
      timestamp: string;
      questions: SentQuestion[];
    }
  | {
      type: "CUSTOMER_ANSWERS";
      timestamp: string;
      answers: CustomerAnswer[];
    }
  | {
      type: "CUSTOMER_QUESTION";
      timestamp: string | null;
      question: CustomerSubmittedQuestion;
    };

type AuctionListingForm = {
  lotTitle: string;
  specs: string;
  photos: string[];
};

type TransmissionType = "Manual" | "Auto";

type DealerOptionForm = {
  optionNumber: 1 | 2 | 3;
  expanded: boolean;
  year: string;
  make: string;
  model: string;
  grade: string;
  mileage: string;
  colour: string;
  transmission: TransmissionType;
  trim: string;
  dealerPriceJpy: string;
  dealerPriceCad: string;
  photos: string[];
  salesSheetUrl: string;
  notes: string;
};

type ResearchDraft = {
  hammerPriceLowJpy: string;
  hammerPriceHighJpy: string;
  recommendedMaxBidJpy: string;
  salesHistoryNotes: string;
  overallNotes: string;
  auctionListings: AuctionListingForm[];
  dealerOptions: DealerOptionForm[];
};

const MAX_QUESTIONS = 10;
const RESEARCH_SUBMIT_ERROR_MESSAGE =
  "Unable to submit research. Please check all fields and try again, or contact support at adam@jdmrushimports.ca";
const QUESTIONS_BASE_STATUS = "questions_sent";
const QUESTIONS_SENT_SUCCESS_MESSAGE =
  "Questions sent to customer. You'll receive an email when the customer submits their answers. Once notified, log back in to review their responses and proceed with research.";
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
] as const;
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

const INITIAL_AUCTION_LISTING: AuctionListingForm = {
  lotTitle: "",
  specs: "",
  photos: [],
};

const INITIAL_DEALER_OPTIONS: DealerOptionForm[] = [
  {
    optionNumber: 1,
    expanded: true,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    dealerPriceCad: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
  {
    optionNumber: 2,
    expanded: false,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    dealerPriceCad: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
  {
    optionNumber: 3,
    expanded: false,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    dealerPriceCad: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
];

function createInitialAuctionListings() {
  return [{ ...INITIAL_AUCTION_LISTING }];
}

function createInitialDealerOptions() {
  return INITIAL_DEALER_OPTIONS.map((option) => ({
    ...option,
    photos: [...option.photos],
  }));
}

function createEmptyResearchDraft(): ResearchDraft {
  return {
    hammerPriceLowJpy: "",
    hammerPriceHighJpy: "",
    recommendedMaxBidJpy: "",
    salesHistoryNotes: "",
    overallNotes: "",
    auctionListings: createInitialAuctionListings(),
    dealerOptions: createInitialDealerOptions(),
  };
}

function toDraftString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeDraftStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeAuctionListingDraft(value: unknown): AuctionListingForm {
  const listing = value && typeof value === "object" ? (value as Partial<AuctionListingForm>) : {};

  return {
    lotTitle: toDraftString(listing.lotTitle),
    specs: toDraftString(listing.specs),
    photos: normalizeDraftStringArray(listing.photos),
  };
}

function normalizeDealerOptionDraft(value: unknown, fallback: DealerOptionForm): DealerOptionForm {
  const option = value && typeof value === "object" ? (value as Partial<DealerOptionForm>) : {};
  const rawOptionNumber =
    typeof option.optionNumber === "number" && option.optionNumber >= 1 && option.optionNumber <= 3
      ? option.optionNumber
      : fallback.optionNumber;

  return {
    optionNumber: rawOptionNumber as 1 | 2 | 3,
    expanded: typeof option.expanded === "boolean" ? option.expanded : fallback.expanded,
    year: toDraftString(option.year),
    make: toDraftString(option.make),
    model: toDraftString(option.model),
    grade: toDraftString(option.grade),
    mileage: toDraftString(option.mileage),
    colour: toDraftString(option.colour),
    transmission: option.transmission === "Auto" || option.transmission === "Manual" ? option.transmission : "Manual",
    trim: toDraftString(option.trim),
    dealerPriceJpy: toDraftString(option.dealerPriceJpy),
    dealerPriceCad: toDraftString(option.dealerPriceCad),
    photos: normalizeDraftStringArray(option.photos),
    salesSheetUrl: toDraftString(option.salesSheetUrl),
    notes: toDraftString(option.notes),
  };
}

function splitSubmittedResearchNotes(value: unknown) {
  const notes = toDraftString(value);
  const [salesHistoryNotes = "", ...recommendationParts] = notes.split(/\n{2,}/);

  return {
    salesHistoryNotes,
    overallNotes: recommendationParts.join("\n\n"),
  };
}

function normalizeResearchDraft(value: unknown): ResearchDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const draft = value as Partial<ResearchDraft>;
  const auctionListings = Array.isArray(draft.auctionListings)
    ? draft.auctionListings.map(normalizeAuctionListingDraft)
    : createInitialAuctionListings();
  const dealerOptionDrafts = Array.isArray(draft.dealerOptions) ? draft.dealerOptions : [];
  const dealerOptions = createInitialDealerOptions().map((fallback) => {
    const savedOption = dealerOptionDrafts.find((option) => {
      if (!option || typeof option !== "object") {
        return false;
      }

      return (option as Partial<DealerOptionForm>).optionNumber === fallback.optionNumber;
    });

    return normalizeDealerOptionDraft(savedOption, fallback);
  });

  return {
    hammerPriceLowJpy: toDraftString(draft.hammerPriceLowJpy),
    hammerPriceHighJpy: toDraftString(draft.hammerPriceHighJpy),
    recommendedMaxBidJpy: toDraftString(draft.recommendedMaxBidJpy),
    salesHistoryNotes: toDraftString(draft.salesHistoryNotes),
    overallNotes: toDraftString(draft.overallNotes),
    auctionListings: auctionListings.length > 0 ? auctionListings : createInitialAuctionListings(),
    dealerOptions,
  };
}

function normalizeSubmittedResearchDraft(
  auctionResearch: AuctionResearchRecord | null,
  dealerOptionRows: PrivateDealerOptionRecord[]
): ResearchDraft {
  const submittedNotes = splitSubmittedResearchNotes(auctionResearch?.sales_history_notes);
  const dealerOptionsByNumber = new Map(
    dealerOptionRows
      .filter((option) => typeof option.option_number === "number")
      .map((option) => [option.option_number, option])
  );

  return {
    hammerPriceLowJpy: toDraftString(auctionResearch?.hammer_price_low_jpy),
    hammerPriceHighJpy: toDraftString(auctionResearch?.hammer_price_high_jpy),
    recommendedMaxBidJpy: toDraftString(auctionResearch?.recommended_max_bid_jpy),
    salesHistoryNotes: submittedNotes.salesHistoryNotes,
    overallNotes: submittedNotes.overallNotes,
    auctionListings:
      Array.isArray(auctionResearch?.auction_listings) && auctionResearch.auction_listings.length > 0
        ? auctionResearch.auction_listings.map(normalizeAuctionListingDraft)
        : createInitialAuctionListings(),
    dealerOptions: createInitialDealerOptions().map((fallback) => {
      const savedOption = dealerOptionsByNumber.get(fallback.optionNumber);

      if (!savedOption) {
        return fallback;
      }

      return {
        optionNumber: fallback.optionNumber,
        expanded: fallback.expanded,
        year: toDraftString(savedOption.year),
        make: toDraftString(savedOption.make),
        model: toDraftString(savedOption.model),
        grade: toDraftString(savedOption.grade),
        mileage: toDraftString(savedOption.mileage),
        colour: toDraftString(savedOption.colour),
        transmission: savedOption.transmission === "Auto" || savedOption.transmission === "Manual" ? savedOption.transmission : "Manual",
        trim: toDraftString(savedOption.trim),
        dealerPriceJpy: toDraftString(savedOption.dealer_price_jpy),
        dealerPriceCad: toDraftString(savedOption.dealer_price_cad),
        photos: normalizeDraftStringArray(savedOption.photos),
        salesSheetUrl: toDraftString(savedOption.sales_sheet_url),
        notes: toDraftString(savedOption.marcus_notes),
      };
    }),
  };
}

async function getUserRole(userId: string, supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (byId.data?.role) {
    return byId.data.role as string;
  }

  const byUserId = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId.data?.role) {
    return byUserId.data.role as string;
  }

  return null;
}

function cleanFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatStatus(status: string | null | undefined) {
  const normalized = status ?? "new";
  return STATUS_LABELS[normalized] ?? normalized;
}

function formatCommunicationTimestamp(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toLocaleString() : "Unknown time";
}

function formatReportDate(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatReportSentMessage(timestamp: string | null) {
  const formattedDate = formatReportDate(timestamp);
  return formattedDate ? `Report sent to customer on ${formattedDate}.` : "Report sent to customer.";
}

function formatChosenPath(path: string | null | undefined) {
  if (path === "private_dealer") {
    return "Private Dealer";
  }

  if (path === "auction") {
    return "Auction";
  }

  return path ? path.replace(/_/g, " ") : "Path not specified";
}

function formatJpy(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? `¥${amount.toLocaleString()}` : "N/A";
}

function formatCad(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0
    ? amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" })
    : "N/A";
}

function isStatusAtOrAfter(status: string | null | undefined, baseStatus: string) {
  const normalized = status ?? "new";
  const currentIndex = STATUS_ORDER.indexOf(normalized as (typeof STATUS_ORDER)[number]);
  const baseIndex = STATUS_ORDER.indexOf(baseStatus as (typeof STATUS_ORDER)[number]);

  if (currentIndex === -1 || baseIndex === -1) {
    return normalized === baseStatus;
  }

  return currentIndex >= baseIndex;
}

function extractStoragePath(filePath: string) {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const marker = "/docket-files/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      }
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("docket-files/")) {
    return trimmed.slice("docket-files/".length);
  }

  return trimmed.replace(/^\/+/, "");
}

function extractOriginalFileName(filePath: string) {
  const storagePath = extractStoragePath(filePath);
  if (!storagePath) {
    return "file";
  }

  const basename = storagePath.split("/").pop() ?? storagePath;
  return basename.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i, "");
}

export default function AgentDocketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loading, setLoading] = useState(true);
  const [docket, setDocket] = useState<Docket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState(["", "", ""]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [questionsConfirmation, setQuestionsConfirmation] = useState<string | null>(null);
  const [proceedConfirmation, setProceedConfirmation] = useState<string | null>(null);
  const [customerAnswers, setCustomerAnswers] = useState<CustomerAnswer[]>([]);
  const [sentQuestions, setSentQuestions] = useState<SentQuestion[]>([]);
  const [customerSubmittedQuestions, setCustomerSubmittedQuestions] = useState<CustomerSubmittedQuestion[]>([]);
  const [reportSentAt, setReportSentAt] = useState<string | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [queuedQuestions, setQueuedQuestions] = useState([""]);
  const [addQuestionLoading, setAddQuestionLoading] = useState(false);
  const [addQuestionSuccess, setAddQuestionSuccess] = useState<string | null>(null);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [isCustomerCommunicationExpanded, setIsCustomerCommunicationExpanded] = useState(true);

  const [hammerPriceLowJpy, setHammerPriceLowJpy] = useState("");
  const [hammerPriceHighJpy, setHammerPriceHighJpy] = useState("");
  const [recommendedMaxBidJpy, setRecommendedMaxBidJpy] = useState("");
  const [salesHistoryNotes, setSalesHistoryNotes] = useState("");
  const [auctionListings, setAuctionListings] = useState<AuctionListingForm[]>(createInitialAuctionListings);
  const [dealerOptions, setDealerOptions] = useState<DealerOptionForm[]>(createInitialDealerOptions);
  const [overallNotes, setOverallNotes] = useState("");
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [submittingResearch, setSubmittingResearch] = useState(false);
  const [researchConfirmation, setResearchConfirmation] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [researchLocked, setResearchLocked] = useState(false);
  const [isEditingSentReport, setIsEditingSentReport] = useState(false);
  const [draftSavedVisible, setDraftSavedVisible] = useState(false);
  const draftHydratedRef = useRef(false);
  const lastSavedDraftRef = useRef<string | null>(null);
  const sentReportEditSnapshotRef = useRef<ResearchDraft | null>(null);

  const currentStatus = docket?.status ?? "new";
  const isResearchInProgress = currentStatus === "research_in_progress";
  const isSubmittedStatus = isStatusAtOrAfter(currentStatus, "report_sent");
  const canProceedWithoutQuestions =
    currentStatus === "new" || currentStatus === "questions_sent" || currentStatus === "answers_received";
  const shouldShowSmartProceedButton = canProceedWithoutQuestions && !researchLocked;
  const shouldShowResearchSummary = isSubmittedStatus && !isEditingSentReport;
  const isFormReadOnly = shouldShowResearchSummary || (researchLocked && !isEditingSentReport);
  const isQuestionsLocked = isStatusAtOrAfter(currentStatus, QUESTIONS_BASE_STATUS);
  const shouldShowResearchForm = isResearchInProgress || (isSubmittedStatus && isEditingSentReport);
  const shouldHideQuestionsAndProceed = isQuestionsLocked || researchLocked;
  const isFormDisabled = submittingResearch || isFormReadOnly;
  const isEditingSubmittedReport = isSubmittedStatus && isEditingSentReport;
  const smartProceedButtonLabel =
    currentStatus === "new"
      ? "Skip Questions — Proceed to Research"
      : currentStatus === "answers_received"
        ? "Proceed to Research"
        : "I Have What I Need — Proceed to Research";
  const smartProceedButtonClassName =
    currentStatus === "answers_received"
      ? "w-full rounded-lg bg-[#22c55e] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      : "w-full rounded-lg bg-[#E55125] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70";
  const reportUrl = docket?.report_url_token
    ? `https://docket.jdmrushimports.ca/report/${docket.report_url_token}`
    : null;
  const chosenPath = docket?.chosen_path ?? docket?.selected_path ?? null;
  const hasAuctionListingSummary = auctionListings.some(
    (listing) =>
      listing.lotTitle.trim().length > 0 || listing.specs.trim().length > 0 || listing.photos.length > 0
  );
  const hasAuctionResearchSummary = [
    hammerPriceLowJpy,
    hammerPriceHighJpy,
    recommendedMaxBidJpy,
    salesHistoryNotes,
  ].some((value) => value.trim().length > 0) || hasAuctionListingSummary;
  const submittedDealerOptions = dealerOptions.filter((option) => hasAnyDealerData(option));
  const researchDraft = useMemo<ResearchDraft>(
    () => ({
      hammerPriceLowJpy,
      hammerPriceHighJpy,
      recommendedMaxBidJpy,
      salesHistoryNotes,
      overallNotes,
      auctionListings,
      dealerOptions,
    }),
    [
      auctionListings,
      dealerOptions,
      hammerPriceHighJpy,
      hammerPriceLowJpy,
      overallNotes,
      recommendedMaxBidJpy,
      salesHistoryNotes,
    ]
  );
  const customerQuestionsLink = docket?.questions_url_token
    ? `https://jdm-rush-docket.vercel.app/questions/${docket.questions_url_token}`
    : null;
  const unreadCustomerQuestionsCount = customerSubmittedQuestions.filter((question) => question.read_at === null).length;
  const unansweredQuestionsCount = Math.max(sentQuestions.length - customerAnswers.length, 0);
  const communicationTimeline = useMemo<CommunicationTimelineEntry[]>(() => {
    const agentQuestionBatches = new Map<string, SentQuestion[]>();
    for (const question of sentQuestions) {
      const batch = agentQuestionBatches.get(question.created_at) ?? [];
      batch.push(question);
      agentQuestionBatches.set(question.created_at, batch);
    }

    const customerAnswerBatches = new Map<string, CustomerAnswer[]>();
    for (const answer of customerAnswers) {
      if (!answer.answered_at) {
        continue;
      }

      const batch = customerAnswerBatches.get(answer.answered_at) ?? [];
      batch.push(answer);
      customerAnswerBatches.set(answer.answered_at, batch);
    }

    return [
      ...Array.from(agentQuestionBatches.entries()).map(
        ([timestamp, questionsForBatch]): CommunicationTimelineEntry => ({
          type: "AGENT_QUESTIONS",
          timestamp,
          questions: questionsForBatch,
        })
      ),
      ...Array.from(customerAnswerBatches.entries()).map(
        ([timestamp, answersForBatch]): CommunicationTimelineEntry => ({
          type: "CUSTOMER_ANSWERS",
          timestamp,
          answers: answersForBatch,
        })
      ),
      ...customerSubmittedQuestions.map(
        (question): CommunicationTimelineEntry => ({
          type: "CUSTOMER_QUESTION",
          timestamp: question.created_at,
          question,
        })
      ),
    ].sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

      return leftTime - rightTime;
    });
  }, [customerAnswers, customerSubmittedQuestions, sentQuestions]);

  async function createSignedPreviewUrl(filePath: string) {
    const storagePath = extractStoragePath(filePath);
    if (!storagePath) {
      return null;
    }

    const { data, error } = await supabase.storage.from("docket-files").createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }

  async function syncPreviewUrls(filePaths: string[]) {
    const missing = filePaths.filter((path) => Boolean(path) && !photoPreviewUrls[path]);
    if (missing.length === 0) {
      return;
    }

    const entries = await Promise.all(
      missing.map(async (path) => {
        const signedUrl = await createSignedPreviewUrl(path);
        return signedUrl ? [path, signedUrl] : null;
      })
    );

    const next: Record<string, string> = {};
    for (const item of entries) {
      if (!item) {
        continue;
      }

      const [path, signedUrl] = item;
      next[path] = signedUrl;
    }

    if (Object.keys(next).length === 0) {
      return;
    }

    setPhotoPreviewUrls((prev) => ({ ...prev, ...next }));
  }

  async function loadSentQuestions(docketId: string) {
    const { data, error } = await supabase
      .from("marcus_questions")
      .select("id, question_text, created_at")
      .eq("docket_id", docketId)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setSentQuestions((data ?? []) as SentQuestion[]);
  }

  async function loadLatestReportSentAt(docketId: string) {
    const { data, error } = await supabase
      .from("email_log")
      .select("sent_at")
      .eq("docket_id", docketId)
      .eq("email_type", "email_4_report_ready")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle<ReportEmailLog>();

    if (error) {
      console.error("[Email Log] Failed to load report sent timestamp", {
        docketId,
        error: error.message,
      });
      return null;
    }

    return data?.sent_at ?? null;
  }

  async function saveResearchDraft(draft: ResearchDraft | null, options?: { showIndicator?: boolean }) {
    const response = await fetch(`/api/admin/dockets/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ research_draft: draft }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Failed to save research draft.");
    }

    lastSavedDraftRef.current = draft === null ? null : JSON.stringify(draft);

    if (options?.showIndicator !== false) {
      setDraftSavedVisible(true);
    }
  }

  useEffect(() => {
    async function loadDocket() {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;

      if (!user) {
        router.replace("/agent/login");
        return;
      }

      const role = await getUserRole(user.id, supabase);

      if (role !== "agent" && role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/agent/login");
        return;
      }

      const { data, error: docketError } = await supabase
        .from("dockets")
        .select(
          "id, questions_url_token, report_url_token, status, chosen_path, selected_path, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, budget_bracket, destination_city, destination_province, timeline, additional_notes, research_draft"
        )
        .eq("id", id)
        .maybeSingle();

      if (docketError || !data) {
        setError(docketError?.message ?? "Docket not found.");
        setLoading(false);
        return;
      }

      const loadedDocket = data as Docket;
      const savedDraft = normalizeResearchDraft(loadedDocket.research_draft);
      const initialDraft = savedDraft ?? createEmptyResearchDraft();

      setDocket(loadedDocket);
      setHammerPriceLowJpy(initialDraft.hammerPriceLowJpy);
      setHammerPriceHighJpy(initialDraft.hammerPriceHighJpy);
      setRecommendedMaxBidJpy(initialDraft.recommendedMaxBidJpy);
      setSalesHistoryNotes(initialDraft.salesHistoryNotes);
      setOverallNotes(initialDraft.overallNotes);
      setAuctionListings(initialDraft.auctionListings);
      setDealerOptions(initialDraft.dealerOptions);
      lastSavedDraftRef.current = JSON.stringify(initialDraft);
      draftHydratedRef.current = true;

      const [
        { data: sentQuestionsData, error: sentQuestionsError },
        { data: answersData, error: answersError },
        { data: customerQuestionsData, error: customerQuestionsError },
        { data: auctionResearchData, error: auctionResearchError },
        { data: dealerOptionsData, error: dealerOptionsError },
        latestReportSentAt,
      ] =
        await Promise.all([
          supabase
            .from("marcus_questions")
            .select("id, question_text, created_at")
            .eq("docket_id", id)
            .order("created_at", { ascending: true }),
          supabase
            .from("marcus_questions")
            .select("id, question_text, answer_text, answered_at")
            .eq("docket_id", id)
            .not("answered_at", "is", null)
            .order("answered_at", { ascending: true }),
          supabase
            .from("customer_questions")
            .select("id, question_text, created_at, read_at")
            .eq("docket_id", id)
            .order("created_at", { ascending: true }),
          supabase
            .from("auction_research")
            .select("hammer_price_low_jpy, hammer_price_high_jpy, recommended_max_bid_jpy, sales_history_notes, auction_listings")
            .eq("docket_id", id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<AuctionResearchRecord>(),
          supabase
            .from("private_dealer_options")
            .select(
              "option_number, year, make, model, grade, mileage, colour, transmission, trim, dealer_price_jpy, dealer_price_cad, photos, sales_sheet_url, marcus_notes"
            )
            .eq("docket_id", id)
            .order("option_number", { ascending: true })
            .returns<PrivateDealerOptionRecord[]>(),
          loadLatestReportSentAt(id),
        ]);

      if (sentQuestionsError) {
        setError(sentQuestionsError.message);
        setLoading(false);
        return;
      }

      if (answersError) {
        setError(answersError.message);
        setLoading(false);
        return;
      }

      if (customerQuestionsError) {
        setError(customerQuestionsError.message);
        setLoading(false);
        return;
      }

      if (auctionResearchError) {
        setError(auctionResearchError.message);
        setLoading(false);
        return;
      }

      if (dealerOptionsError) {
        setError(dealerOptionsError.message);
        setLoading(false);
        return;
      }

      const hydratedDraft =
        savedDraft ?? normalizeSubmittedResearchDraft(auctionResearchData, dealerOptionsData ?? []);

      setSentQuestions((sentQuestionsData ?? []) as SentQuestion[]);
      setCustomerAnswers((answersData ?? []) as CustomerAnswer[]);
      setCustomerSubmittedQuestions((customerQuestionsData ?? []) as CustomerSubmittedQuestion[]);
      setReportSentAt(latestReportSentAt);
      setHammerPriceLowJpy(hydratedDraft.hammerPriceLowJpy);
      setHammerPriceHighJpy(hydratedDraft.hammerPriceHighJpy);
      setRecommendedMaxBidJpy(hydratedDraft.recommendedMaxBidJpy);
      setSalesHistoryNotes(hydratedDraft.salesHistoryNotes);
      setOverallNotes(hydratedDraft.overallNotes);
      setAuctionListings(hydratedDraft.auctionListings);
      setDealerOptions(hydratedDraft.dealerOptions);
      lastSavedDraftRef.current = JSON.stringify(hydratedDraft);

      const unreadQuestions = (customerQuestionsData ?? []).filter((question) => question.read_at === null);
      if (unreadQuestions.length > 0) {
        await supabase
          .from("customer_questions")
          .update({ read_at: new Date().toISOString() })
          .eq("docket_id", id)
          .is("read_at", null);
      }

      setLoading(false);
    }

    void loadDocket();
  }, [id, router, supabase]);

  useEffect(() => {
    if (
      !draftHydratedRef.current ||
      !docket ||
      !shouldShowResearchForm ||
      isFormDisabled ||
      isFormReadOnly
    ) {
      return;
    }

    const serializedDraft = JSON.stringify(researchDraft);
    if (serializedDraft === lastSavedDraftRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveResearchDraft(researchDraft).catch((draftError) => {
        console.error("[Research Draft] AUTO_SAVE_FAILED", {
          docketId: id,
          error: draftError instanceof Error ? draftError.message : draftError,
        });
      });
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [docket, id, isFormDisabled, isFormReadOnly, researchDraft, shouldShowResearchForm]);

  useEffect(() => {
    if (!draftSavedVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDraftSavedVisible(false);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftSavedVisible]);

  useEffect(() => {
    if (!docket) {
      return;
    }

    let cancelled = false;

    async function hydratePreviewUrls() {
      const paths = [
        ...auctionListings.flatMap((listing) => listing.photos),
        ...dealerOptions.flatMap((option) => option.photos),
      ]
        .map((path) => path.trim())
        .filter((path, index, array) => path.length > 0 && array.indexOf(path) === index);

      if (paths.length === 0) {
        return;
      }

      const signedEntries = await Promise.all(
        paths.map(async (path) => {
          const storagePath = extractStoragePath(path);
          if (!storagePath) {
            return null;
          }

          const { data, error } = await supabase.storage.from("docket-files").createSignedUrl(storagePath, 3600);
          if (error || !data?.signedUrl) {
            return null;
          }

          return [path, data.signedUrl] as const;
        })
      );

      if (cancelled) {
        return;
      }

      const nextEntries = signedEntries.filter((item): item is readonly [string, string] => Boolean(item));

      if (nextEntries.length === 0) {
        return;
      }

      setPhotoPreviewUrls((prev) => ({ ...prev, ...Object.fromEntries(nextEntries) }));
    }

    void hydratePreviewUrls();

    return () => {
      cancelled = true;
    };
  }, [auctionListings, dealerOptions, docket, supabase]);

  useEffect(() => {
    if (redirectCountdown === null) {
      return;
    }

    if (redirectCountdown <= 0) {
      router.replace("/agent/dashboard");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRedirectCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [redirectCountdown, router]);

  function updateQuestion(index: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addQuestionField() {
    if (shouldHideQuestionsAndProceed) {
      return;
    }

    setQuestions((prev) => {
      if (prev.length >= MAX_QUESTIONS) {
        return prev;
      }

      return [...prev, ""];
    });
  }

  async function sendQuestions() {
    if (shouldHideQuestionsAndProceed) {
      return;
    }

    const cleanedQuestions = questions.map((question) => question.trim()).filter(Boolean);

    if (cleanedQuestions.length === 0) {
      setError("Enter at least one question before sending.");
      return;
    }

    setSavingQuestions(true);
    setError(null);
    setQuestionsConfirmation(null);

    const response = await fetch("/api/agent/send-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        docketId: id,
        questions: cleanedQuestions,
      }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to send questions.");
      setSavingQuestions(false);
      return;
    }

    setDocket((prev) => (prev?.status === "new" ? { ...prev, status: "questions_sent" } : prev));
    await loadSentQuestions(id);
    setQuestionsConfirmation(QUESTIONS_SENT_SUCCESS_MESSAGE);
    setAddQuestionSuccess(null);
    setSavingQuestions(false);
  }

  function updateQueuedQuestion(index: number, value: string) {
    setQueuedQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addQueuedQuestionField() {
    setQueuedQuestions((prev) => {
      if (prev.length >= MAX_QUESTIONS) {
        return prev;
      }

      return [...prev, ""];
    });
  }

  async function sendQueuedQuestions() {
    if (!isQuestionsLocked || addQuestionLoading) {
      return;
    }

    const cleanedQuestions = queuedQuestions.map((question) => question.trim()).filter(Boolean);

    if (cleanedQuestions.length === 0) {
      setError("Enter at least one question before sending.");
      return;
    }

    setAddQuestionLoading(true);
    setError(null);
    setAddQuestionSuccess(null);
    setQuestionsConfirmation(null);

    const response = await fetch("/api/agent/send-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        docketId: id,
        questions: cleanedQuestions,
      }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to send question.");
      setAddQuestionLoading(false);
      return;
    }

    await loadSentQuestions(id);
    setDocket((prev) => (prev?.status === "new" ? { ...prev, status: "questions_sent" } : prev));
    setQueuedQuestions([""]);
    setAddingQuestion(false);
    setAddQuestionSuccess(QUESTIONS_SENT_SUCCESS_MESSAGE);
    setAddQuestionLoading(false);
  }

  async function proceedWithoutQuestions() {
    if (!canProceedWithoutQuestions || proceeding) {
      return;
    }

    setProceeding(true);
    setError(null);
    setProceedConfirmation(null);

    const response = await fetch("/api/agent/proceed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ docketId: id }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to update docket.");
      setProceeding(false);
      return;
    }

    setDocket((prev) => (prev ? { ...prev, status: "research_in_progress" } : prev));
    setProceedConfirmation("Confirmed. You can now complete and send the research report below.");
    setProceeding(false);
  }

  function updateAuctionListing(index: number, patch: Partial<AuctionListingForm>) {
    setAuctionListings((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addAuctionListing() {
    setAuctionListings((prev) => [...prev, { ...INITIAL_AUCTION_LISTING }]);
  }

  function removeAuctionListing(index: number) {
    setAuctionListings((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function removeAuctionListingPhoto(listingIndex: number, photoIndex: number) {
    setAuctionListings((prev) =>
      prev.map((listing, index) =>
        index === listingIndex
          ? {
              ...listing,
              photos: listing.photos.filter((_, indexInPhotos) => indexInPhotos !== photoIndex),
            }
          : listing
      )
    );
  }

  function updateDealerOption(optionNumber: number, patch: Partial<DealerOptionForm>) {
    setDealerOptions((prev) =>
      prev.map((item) => (item.optionNumber === optionNumber ? { ...item, ...patch } : item))
    );
  }

  function removeDealerOptionPhoto(optionNumber: number, photoIndex: number) {
    setDealerOptions((prev) =>
      prev.map((option) =>
        option.optionNumber === optionNumber
          ? {
              ...option,
              photos: option.photos.filter((_, indexInPhotos) => indexInPhotos !== photoIndex),
            }
          : option
      )
    );
  }

  async function uploadFiles({
    files,
    fileType,
    target,
  }: {
    files: FileList;
    fileType: "images" | "pdf";
    target: string;
  }) {
    if (files.length === 0) {
      return [] as string[];
    }

    setError(null);
    setUploadingTarget(target);

    const uploadedPaths: string[] = [];
    console.error("[Research Upload] START", {
      docketId: id,
      target,
      fileCount: files.length,
      fileType,
      at: new Date().toISOString(),
    });

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setUploadingTarget(null);
      const sessionMessage = sessionError?.message ?? "Missing authenticated session token for storage upload.";
      console.error("[Research Upload] SESSION_FAILED", { sessionError });
      throw new Error(`Authentication required for file upload: ${sessionMessage}`);
    }

    const storageClient = createBrowserSupabaseClientWithAuth(session.access_token);

    for (const file of Array.from(files)) {
      if (!(file instanceof File)) {
        setUploadingTarget(null);
        throw new Error("Upload payload must contain File objects.");
      }

      if (file.size <= 0) {
        setUploadingTarget(null);
        throw new Error(`File "${file.name}" is empty and cannot be uploaded.`);
      }

      if (fileType === "images" && !file.type.startsWith("image/")) {
        setUploadingTarget(null);
        throw new Error("Only image files are allowed for photo uploads.");
      }

      if (fileType === "pdf" && file.type !== "application/pdf") {
        setUploadingTarget(null);
        throw new Error("Only PDF files are allowed for sales sheets.");
      }

      const storagePath = `${id}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      console.error("[Research Upload] FILE_UPLOAD_ATTEMPT", {
        bucketPath: `docket-files/${storagePath}`,
        fileName: file.name,
        mimeType: file.type,
        bytes: file.size,
      });
      const { error: uploadError } = await storageClient.storage
        .from("docket-files")
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        console.error("[Research Upload] FILE_UPLOAD_FAILED", {
          bucketPath: `docket-files/${storagePath}`,
          uploadError,
        });
        setUploadingTarget(null);
        throw new Error(
          `Upload failed for "${file.name}" at docket-files/${storagePath}: ${uploadError.message}`
        );
      }

      uploadedPaths.push(storagePath);
      console.error("[Research Upload] FILE_UPLOAD_SUCCESS", {
        bucketPath: `docket-files/${storagePath}`,
      });
    }

    setUploadingTarget(null);
    console.error("[Research Upload] COMPLETE", {
      docketId: id,
      uploadedCount: uploadedPaths.length,
    });
    return uploadedPaths;
  }

  async function handleAuctionListingPhotosUpload(index: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        fileType: "images",
        target: `auction-listing-${index + 1}`,
      });

      updateAuctionListing(index, {
        photos: [...auctionListings[index].photos, ...uploaded],
      });
      await syncPreviewUrls(uploaded);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload listing photos.";
      setError(message);
    }
  }

  async function handleDealerOptionPhotosUpload(optionNumber: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    const currentOption = dealerOptions.find((option) => option.optionNumber === optionNumber);

    if (!currentOption) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        fileType: "images",
        target: `dealer-option-${optionNumber}-photos`,
      });

      updateDealerOption(optionNumber, {
        photos: [...currentOption.photos, ...uploaded],
      });
      await syncPreviewUrls(uploaded);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload dealer photos.";
      setError(message);
    }
  }

  async function handleDealerSalesSheetUpload(optionNumber: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        fileType: "pdf",
        target: `dealer-option-${optionNumber}-sales-sheet`,
      });

      if (uploaded.length > 0) {
        updateDealerOption(optionNumber, { salesSheetUrl: uploaded[0] });
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload sales sheet.";
      setError(message);
    }
  }

  function hasAnyDealerData(option: DealerOptionForm) {
    return [
      option.year,
      option.make,
      option.model,
      option.grade,
      option.mileage,
      option.colour,
      option.trim,
      option.dealerPriceJpy,
      option.dealerPriceCad,
      option.notes,
      option.salesSheetUrl,
    ].some((value) => value.trim().length > 0) || option.photos.length > 0;
  }

  function validateResearchForm() {
    const validationErrors: string[] = [];
    const low = Number(hammerPriceLowJpy);
    const high = Number(hammerPriceHighJpy);
    const maxBid = Number(recommendedMaxBidJpy);
    const hasAuctionData =
      hammerPriceLowJpy.trim().length > 0 ||
      hammerPriceHighJpy.trim().length > 0 ||
      recommendedMaxBidJpy.trim().length > 0 ||
      auctionListings.some(
        (listing) => listing.lotTitle.trim().length > 0 || listing.specs.trim().length > 0
      );

    if (hasAuctionData) {
      if (!Number.isFinite(low) || low <= 0) {
        validationErrors.push("Hammer Price Low (JPY) is required and must be greater than 0.");
      }

      if (!Number.isFinite(high) || high <= 0) {
        validationErrors.push("Hammer Price High (JPY) is required and must be greater than 0.");
      }

      if (Number.isFinite(low) && Number.isFinite(high) && high < low) {
        validationErrors.push(
          "Hammer Price High (JPY) must be greater than or equal to Hammer Price Low (JPY)."
        );
      }

      if (!Number.isFinite(maxBid) || maxBid <= 0) {
        validationErrors.push("Recommended Max Bid (JPY) is required and must be greater than 0.");
      }

      for (let index = 0; index < auctionListings.length; index += 1) {
        const listing = auctionListings[index];

        if (!listing.lotTitle.trim() || !listing.specs.trim()) {
          validationErrors.push(`Auction Listing ${index + 1} requires Lot Title and Specs.`);
        }
      }
    }

    const primaryOption = dealerOptions.find((option) => option.optionNumber === 1);
    const hasPrimaryDealerData =
      Boolean(primaryOption) &&
      [
        primaryOption?.year,
        primaryOption?.make,
        primaryOption?.model,
        primaryOption?.dealerPriceJpy,
      ].some((value) => Boolean(value?.trim()));
    const hasAdditionalDealerData = dealerOptions
      .filter((item) => item.optionNumber !== 1)
      .some((option) => hasAnyDealerData(option));

    if (!hasAuctionData && !hasPrimaryDealerData && !hasAdditionalDealerData) {
      validationErrors.push("You must provide at least one private dealer option or auction research data.");
    }

    if (
      hasPrimaryDealerData &&
      (!primaryOption || !primaryOption.year.trim() || !primaryOption.make.trim() || !primaryOption.model.trim())
    ) {
      validationErrors.push("Private Dealer Option 1 requires Year, Make, and Model.");
    }

    if (
      hasPrimaryDealerData &&
      (!primaryOption ||
        !Number.isFinite(Number(primaryOption.dealerPriceJpy)) ||
        Number(primaryOption.dealerPriceJpy) <= 0)
    ) {
      validationErrors.push("Private Dealer Option 1 requires a valid Dealer Price (JPY).");
    }

    for (const option of dealerOptions.filter((item) => item.optionNumber !== 1)) {
      if (!hasAnyDealerData(option)) {
        continue;
      }

      if (!option.year.trim() || !option.make.trim() || !option.model.trim()) {
        validationErrors.push(
          `Private Dealer Option ${option.optionNumber} must include Year, Make, and Model when used.`
        );
      }

      if (!Number.isFinite(Number(option.dealerPriceJpy)) || Number(option.dealerPriceJpy) <= 0) {
        validationErrors.push(
          `Private Dealer Option ${option.optionNumber} must include a valid Dealer Price (JPY) when used.`
        );
      }
    }

    if (!overallNotes.trim()) {
      validationErrors.push("Overall Notes are required before sending to the customer.");
    }

    return validationErrors;
  }

  async function submitResearchReport() {
    console.log("[Research Submit] START", {
      docketId: id,
      submittingResearch,
      researchLocked,
      at: new Date().toISOString(),
    });

    if (isFormDisabled) {
      console.log("[Research Submit] BLOCKED", {
        reason: researchLocked ? "research_locked" : "submit_in_progress",
      });
      return;
    }

    const validationErrors = validateResearchForm();

    if (validationErrors.length > 0) {
      const message = `Validation failed. Fix the following fields:\n${validationErrors
        .map((item) => `- ${item}`)
        .join("\n")}`;
      console.error("[Research Submit] VALIDATION_FAILED", { validationErrors });
      setError(message);
      return;
    }

    setError(null);
    setResearchConfirmation(null);
    setSubmittingResearch(true);

    const payload = {
      hammerPriceLowJpy: Number(hammerPriceLowJpy),
      hammerPriceHighJpy: Number(hammerPriceHighJpy),
      recommendedMaxBidJpy: Number(recommendedMaxBidJpy),
      salesHistoryNotes: salesHistoryNotes.trim(),
      auctionListings: auctionListings.map((listing) => ({
        lotTitle: listing.lotTitle.trim(),
        specs: listing.specs.trim(),
        photos: listing.photos,
      })),
      privateDealerOptions: dealerOptions
        .filter((option) => option.optionNumber === 1 || hasAnyDealerData(option))
        .map((option) => ({
          optionNumber: option.optionNumber,
          year: option.year.trim(),
          make: option.make.trim(),
          model: option.model.trim(),
          grade: option.grade.trim(),
          mileage: option.mileage.trim(),
          colour: option.colour.trim(),
          transmission: option.transmission,
          trim: option.trim.trim(),
          dealerPriceJpy: Number(option.dealerPriceJpy),
          photos: option.photos,
          salesSheetUrl: option.salesSheetUrl.trim(),
          notes: option.notes.trim(),
      })),
      overallNotes: overallNotes.trim(),
    };

    console.log("[Research Submit] PAYLOAD", payload);

    let result: { success?: boolean; error?: string; details?: unknown } | null = null;
    let response: Response;

    try {
      response = await fetch(`/api/agent/research/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (requestError) {
      console.error("[Research Submit] FETCH_FAILED", { requestError });
      setError(RESEARCH_SUBMIT_ERROR_MESSAGE);
      setSubmittingResearch(false);
      return;
    }

    try {
      result = (await response.json()) as { success?: boolean; error?: string; details?: unknown };
    } catch (parseError) {
      console.error("[Research Submit] RESPONSE_PARSE_FAILED", { parseError });
      setError(RESEARCH_SUBMIT_ERROR_MESSAGE);
      setSubmittingResearch(false);
      return;
    }

    if (!response.ok || !result?.success) {
      console.error("[Research Submit] API_FAILED", {
        status: response.status,
        result,
      });
      setError(RESEARCH_SUBMIT_ERROR_MESSAGE);
      setSubmittingResearch(false);
      return;
    }

    try {
      await saveResearchDraft(null, { showIndicator: false });
    } catch (draftError) {
      console.error("[Research Draft] CLEAR_AFTER_SUBMIT_FAILED", {
        docketId: id,
        error: draftError instanceof Error ? draftError.message : draftError,
      });
    }

    setDocket((prev) => (prev ? { ...prev, status: "report_sent" } : prev));
    setReportSentAt(await loadLatestReportSentAt(id));
    setResearchLocked(true);
    setIsEditingSentReport(false);
    setRedirectCountdown(3);
    setResearchConfirmation("✅ Research submitted successfully. Returning to your dockets in 3 seconds...");
    setSubmittingResearch(false);
  }

  async function resetResearchForm() {
    if (isFormDisabled) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure? This will clear all research form fields and delete your saved draft."
    );

    if (!confirmed) {
      return;
    }

    const emptyDraft = createEmptyResearchDraft();

    setError(null);
    setHammerPriceLowJpy(emptyDraft.hammerPriceLowJpy);
    setHammerPriceHighJpy(emptyDraft.hammerPriceHighJpy);
    setRecommendedMaxBidJpy(emptyDraft.recommendedMaxBidJpy);
    setSalesHistoryNotes(emptyDraft.salesHistoryNotes);
    setOverallNotes(emptyDraft.overallNotes);
    setAuctionListings(emptyDraft.auctionListings);
    setDealerOptions(emptyDraft.dealerOptions);
    lastSavedDraftRef.current = JSON.stringify(emptyDraft);

    try {
      await saveResearchDraft(null, { showIndicator: false });
      lastSavedDraftRef.current = JSON.stringify(emptyDraft);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Failed to clear saved draft.");
    }
  }

  function restoreResearchDraft(draft: ResearchDraft) {
    setHammerPriceLowJpy(draft.hammerPriceLowJpy);
    setHammerPriceHighJpy(draft.hammerPriceHighJpy);
    setRecommendedMaxBidJpy(draft.recommendedMaxBidJpy);
    setSalesHistoryNotes(draft.salesHistoryNotes);
    setOverallNotes(draft.overallNotes);
    setAuctionListings(draft.auctionListings.map((listing) => ({ ...listing, photos: [...listing.photos] })));
    setDealerOptions(
      draft.dealerOptions.map((option) => ({
        ...option,
        photos: [...option.photos],
      }))
    );
  }

  function startSentReportEdit() {
    sentReportEditSnapshotRef.current = {
      ...researchDraft,
      auctionListings: researchDraft.auctionListings.map((listing) => ({ ...listing, photos: [...listing.photos] })),
      dealerOptions: researchDraft.dealerOptions.map((option) => ({
        ...option,
        photos: [...option.photos],
      })),
    };
    setIsEditingSentReport(true);
    setResearchLocked(false);
    setResearchConfirmation(null);
    setRedirectCountdown(null);
  }

  function cancelSentReportEdit() {
    if (sentReportEditSnapshotRef.current) {
      restoreResearchDraft(sentReportEditSnapshotRef.current);
      lastSavedDraftRef.current = JSON.stringify(sentReportEditSnapshotRef.current);
    }

    sentReportEditSnapshotRef.current = null;
    setIsEditingSentReport(false);
    setResearchLocked(true);
    setResearchConfirmation(null);
    setRedirectCountdown(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b border-white/10 pb-5">
          <img
            src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
            alt="JDM Rush Imports"
            style={{ height: "36px", display: "block", marginBottom: "4px" }}
          />
          <h1 className="mt-2 text-3xl font-semibold">Docket Details</h1>
        </header>

        {loading ? <p className="text-white/75">Loading docket...</p> : null}
        {error ? <p className="whitespace-pre-line text-red-400">{error}</p> : null}
        {questionsConfirmation ? (
          <p className="whitespace-pre-line text-emerald-400">{questionsConfirmation}</p>
        ) : null}
        {!loading && docket ? (
          <>
            <div>
              <Link
                className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                href="/agent/dashboard"
              >
                ← Back to Dockets
              </Link>
            </div>

            <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
              <h2 className="mb-4 text-xl font-semibold">Sales Lead Information</h2>
              <div className="grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                {docket.vehicle_description?.trim() ? (
                  <p className="sm:col-span-2">
                    <span className="text-white">Customer&apos;s Vehicle Request:</span> {docket.vehicle_description}
                  </p>
                ) : null}
                <p>
                  <span className="text-white">Name:</span> {docket.customer_first_name || ""} {docket.customer_last_name || ""}
                </p>
                <p>
                  <span className="text-white">Email:</span> {docket.customer_email || "N/A"}
                </p>
                <p>
                  <span className="text-white">Phone:</span> {docket.customer_phone || "N/A"}
                </p>
                <p>
                  <span className="text-white">Vehicle:</span>{" "}
                  {[docket.vehicle_year, docket.vehicle_make, docket.vehicle_model].filter(Boolean).join(" ") || "N/A"}
                </p>
                <p>
                  <span className="text-white">Budget:</span> {docket.budget_bracket || "N/A"}
                </p>
                <p>
                  <span className="text-white">Destination:</span>{" "}
                  {[docket.destination_city, docket.destination_province].filter(Boolean).join(", ") || "N/A"}
                </p>
                <p>
                  <span className="text-white">Timeline:</span> {docket.timeline || "N/A"}
                </p>
                <p>
                  <span className="text-white">Current Status:</span> {formatStatus(docket.status)}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-white">Additional Notes:</span> {docket.additional_notes || "N/A"}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-white/12 border-l-4 border-l-[#E55125] bg-[#171717] p-5">
              <button
                aria-expanded={isCustomerCommunicationExpanded}
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsCustomerCommunicationExpanded((prev) => !prev)}
                type="button"
              >
                <h2 className="text-xl font-semibold">
                  Customer Communication
                  {unreadCustomerQuestionsCount > 0 ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-[#E55125]/20 px-2 py-0.5 text-xs font-medium text-[#E55125]">
                      {unreadCustomerQuestionsCount}
                    </span>
                  ) : null}
                </h2>
                <span
                  aria-hidden="true"
                  className={`text-xl text-[#E55125] transition-transform ${isCustomerCommunicationExpanded ? "rotate-180" : ""}`}
                >
                  v
                </span>
              </button>

              {isCustomerCommunicationExpanded ? (
                <div className="mt-5 space-y-6">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    {communicationTimeline.length === 0 ? (
                      <p className="text-sm text-white/70">No customer communication yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {communicationTimeline.map((entry) => {
                          if (entry.type === "AGENT_QUESTIONS") {
                            return (
                              <article
                                className="rounded-lg border border-white/10 border-l-4 border-l-[#E55125] bg-black/25 p-4"
                                key={`agent-questions-${entry.timestamp}`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <h3 className="text-sm font-medium text-white">
                                    <span aria-hidden="true" className="mr-2">
                                      📤
                                    </span>
                                    Agent sent {entry.questions.length}{" "}
                                    {entry.questions.length === 1 ? "question" : "questions"}
                                  </h3>
                                  <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                                    {formatCommunicationTimestamp(entry.timestamp)}
                                  </time>
                                </div>
                                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/85">
                                  {entry.questions.map((question) => (
                                    <li key={question.id}>{question.question_text}</li>
                                  ))}
                                </ol>
                              </article>
                            );
                          }

                          if (entry.type === "CUSTOMER_ANSWERS") {
                            return (
                              <article
                                className="rounded-lg border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-4"
                                key={`customer-answers-${entry.timestamp}`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <h3 className="text-sm font-medium text-white">
                                    <span aria-hidden="true" className="mr-2">
                                      📥
                                    </span>
                                    Customer answered
                                  </h3>
                                  <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                                    {formatCommunicationTimestamp(entry.timestamp)}
                                  </time>
                                </div>
                                {entry.answers.length > 1 ? (
                                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#E55125]">
                                    {entry.answers.map((answer) => (
                                      <li key={answer.id}>{answer.answer_text || "No answer provided."}</li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="mt-3 text-sm text-[#E55125]">
                                    {entry.answers[0]?.answer_text || "No answer provided."}
                                  </p>
                                )}
                              </article>
                            );
                          }

                          return (
                            <article
                              className={`rounded-lg border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-4 ${
                                entry.question.read_at === null ? "border-l-[#E55125] bg-[#E55125]/5" : ""
                              }`}
                              key={`customer-question-${entry.question.id}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <h3 className="text-sm font-medium text-white">
                                  <span aria-hidden="true" className="mr-2">
                                    💬
                                  </span>
                                  Customer asked
                                </h3>
                                {entry.timestamp ? (
                                  <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                                    {formatCommunicationTimestamp(entry.timestamp)}
                                  </time>
                                ) : (
                                  <span className="text-xs text-white/60">Unknown time</span>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-white/90">{entry.question.question_text}</p>
                            </article>
                          );
                        })}

                        {isQuestionsLocked && unansweredQuestionsCount > 0 ? (
                          <article className="rounded-lg border border-white/10 border-l-4 border-l-white/20 bg-black/25 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <h3 className="text-sm font-medium text-white/60">
                                <span aria-hidden="true" className="mr-2">
                                  ⏳
                                </span>
                                Awaiting customer response
                              </h3>
                            </div>
                          </article>
                        ) : null}
                      </div>
                    )}

                    {isQuestionsLocked ? (
                      <>
                        {customerQuestionsLink ? (
                          <p className="mt-4 text-xs text-white/80">
                            Customer questions URL:{" "}
                            <a
                              className="text-[#E55125] underline underline-offset-2 hover:text-[#f47a55]"
                              href={customerQuestionsLink}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {customerQuestionsLink}
                            </a>
                          </p>
                        ) : (
                          <p className="mt-4 text-xs text-white/70">Customer questions URL unavailable for this docket.</p>
                        )}

                        <div className="mt-4">
                          <button
                            className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={addQuestionLoading}
                            onClick={() => {
                              setAddingQuestion((prev) => !prev);
                              setQueuedQuestions((prev) => (prev.length > 0 ? prev : [""]));
                              setAddQuestionSuccess(null);
                            }}
                            type="button"
                          >
                            + Add a Question
                          </button>
                        </div>

                        {addingQuestion ? (
                          <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                            <div className="space-y-3">
                              {queuedQuestions.map((queuedQuestion, index) => (
                                <label className="block text-sm text-white/85" key={`queued-question-${index + 1}`}>
                                  New Question {index + 1}
                                  <textarea
                                    className="mt-1 min-h-[120px] w-full resize-y rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                    disabled={addQuestionLoading}
                                    onChange={(event) => updateQueuedQuestion(index, event.target.value)}
                                    placeholder="Type your question here..."
                                    value={queuedQuestion}
                                  />
                                </label>
                              ))}
                            </div>
                            <button
                              className="text-sm font-medium text-[#E55125] underline underline-offset-2 transition hover:text-[#f47a55] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={addQuestionLoading || queuedQuestions.length >= MAX_QUESTIONS}
                              onClick={addQueuedQuestionField}
                              type="button"
                            >
                              + Add Another
                            </button>
                            <button
                              className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={addQuestionLoading}
                              onClick={sendQueuedQuestions}
                              type="button"
                            >
                              {addQuestionLoading ? "Sending..." : "Send Questions"}
                            </button>
                          </div>
                        ) : null}

                        {addQuestionSuccess ? <p className="mt-3 text-sm text-emerald-400">{addQuestionSuccess}</p> : null}
                      </>
                    ) : !shouldHideQuestionsAndProceed ? (
                      <>
                        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                          {questions.map((question, index) => (
                            <label className="block text-sm text-white/85" key={`question-${index + 1}`}>
                              Question {index + 1}
                              <textarea
                                className="mt-1 min-h-[120px] w-full resize-y rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                disabled={false}
                                onChange={(event) => updateQuestion(index, event.target.value)}
                                placeholder="Type your question here..."
                                value={question}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={questions.length >= MAX_QUESTIONS}
                            onClick={addQuestionField}
                            type="button"
                          >
                            + Add Question
                          </button>
                          <button
                            className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={savingQuestions}
                            onClick={sendQuestions}
                            type="button"
                          >
                            {savingQuestions ? "Sending..." : "Send Questions to Customer"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {shouldShowSmartProceedButton ? (
              <section>
                <button
                  className={smartProceedButtonClassName}
                  disabled={proceeding}
                  onClick={proceedWithoutQuestions}
                  type="button"
                >
                  {proceeding ? "Confirming..." : smartProceedButtonLabel}
                </button>
                {proceedConfirmation ? <p className="mt-3 text-sm text-emerald-400">{proceedConfirmation}</p> : null}
              </section>
            ) : null}

            {isSubmittedStatus ? (
              <section className="rounded-xl border border-white/12 border-l-4 border-l-[#22c55e] bg-[#22c55e]/10 p-5">
                <p className="text-sm font-medium text-white">{formatReportSentMessage(reportSentAt)}</p>
                {reportUrl ? (
                  <a
                    className="mt-2 inline-flex text-sm font-medium text-[#22c55e] underline underline-offset-2 hover:text-green-300"
                    href={reportUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View report
                  </a>
                ) : null}
              </section>
            ) : null}

            {currentStatus === "decision_made" ? (
              <section className="rounded-xl border border-white/12 border-l-4 border-l-[#22c55e] bg-[#22c55e]/10 p-5">
                <p className="text-sm font-medium text-white">
                  Customer has approved — {formatChosenPath(chosenPath)}. Awaiting deposit and purchase agreement.
                </p>
              </section>
            ) : null}

            {shouldShowResearchSummary ? (
              <section className="space-y-6 rounded-xl border border-white/12 bg-[#171717] p-5">
                <div>
                  <h2 className="text-xl font-semibold">Research Summary</h2>
                  <p className="mt-1 text-sm text-white/60">Submitted report data for review.</p>
                </div>

                {hasAuctionResearchSummary ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="text-lg font-medium">Auction Research</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-white/10 bg-black/25 p-3">
                        <p className="text-xs uppercase tracking-wide text-white/45">Hammer Price Range</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {formatJpy(hammerPriceLowJpy)} - {formatJpy(hammerPriceHighJpy)}
                        </p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/25 p-3">
                        <p className="text-xs uppercase tracking-wide text-white/45">Recommended Max Bid</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatJpy(recommendedMaxBidJpy)}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/25 p-3">
                        <p className="text-xs uppercase tracking-wide text-white/45">Auction Lots</p>
                        <p className="mt-1 text-sm font-semibold text-white">{auctionListings.length}</p>
                      </div>
                    </div>
                    {salesHistoryNotes.trim() ? (
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-wide text-white/45">Sales History Notes</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">{salesHistoryNotes}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {submittedDealerOptions.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Private Dealer Options</h3>
                    {submittedDealerOptions.map((option) => {
                      const vehicleDetails = [
                        option.year,
                        option.make,
                        option.model,
                        option.grade,
                        option.mileage,
                        option.colour,
                        option.transmission,
                        option.trim,
                      ].filter((value) => value.trim().length > 0);

                      return (
                        <article
                          className="rounded-lg border border-white/10 bg-black/20 p-4"
                          key={`summary-dealer-option-${option.optionNumber}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-white">Option {option.optionNumber}</h4>
                              <p className="mt-1 text-sm text-white/70">
                                {vehicleDetails.length > 0 ? vehicleDetails.join(" / ") : "Vehicle details not provided"}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-semibold text-white">{formatJpy(option.dealerPriceJpy)}</p>
                              <p className="text-white/60">{formatCad(option.dealerPriceCad)}</p>
                            </div>
                          </div>

                          {option.photos.length > 0 ? (
                            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                              {option.photos.map((photoPath, photoIndex) => {
                                const previewUrl = photoPreviewUrls[photoPath];
                                const fileName = extractOriginalFileName(photoPath);

                                return (
                                  <div
                                    className="aspect-square overflow-hidden rounded-md border border-white/15 bg-black/35"
                                    key={`${option.optionNumber}-${photoPath}-${photoIndex}`}
                                    title={fileName}
                                  >
                                    {previewUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img alt={fileName} className="h-full w-full object-cover" src={previewUrl} />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
                                        No preview
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {option.notes.trim() ? (
                            <div className="mt-4">
                              <p className="text-xs uppercase tracking-wide text-white/45">Notes</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">{option.notes}</p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {overallNotes.trim() ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="text-lg font-medium">Overall Notes / Recommendation</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">{overallNotes}</p>
                  </div>
                ) : null}

                {!hasAuctionResearchSummary && submittedDealerOptions.length === 0 && !overallNotes.trim() ? (
                  <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                    No submitted research data was found for this docket.
                  </p>
                ) : null}

                <div className="flex justify-end">
                  <button
                    className="rounded-lg border border-white/25 bg-transparent px-5 py-2.5 text-sm font-medium text-white/75 transition hover:border-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={startSentReportEdit}
                    type="button"
                  >
                    Edit &amp; Resend Report
                  </button>
                </div>
              </section>
            ) : null}

            {shouldShowResearchForm ? (
              <section className="space-y-6 rounded-xl border border-white/12 bg-[#171717] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Marcus Research Input Form</h2>
                  {draftSavedVisible ? (
                    <span className="text-xs font-medium text-emerald-300/90">Draft saved</span>
                  ) : null}
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Auction Sales History</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="text-sm text-white/85">
                      Hammer Price Low (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setHammerPriceLowJpy(event.target.value)}
                        placeholder="e.g. 1200000"
                        type="number"
                        value={hammerPriceLowJpy}
                      />
                    </label>
                    <label className="text-sm text-white/85">
                      Hammer Price High (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setHammerPriceHighJpy(event.target.value)}
                        placeholder="e.g. 1700000"
                        type="number"
                        value={hammerPriceHighJpy}
                      />
                    </label>
                    <label className="text-sm text-white/85">
                      Recommended Max Bid (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setRecommendedMaxBidJpy(event.target.value)}
                        placeholder="e.g. 1600000"
                        type="number"
                        value={recommendedMaxBidJpy}
                      />
                    </label>
                  </div>
                  <label className="block text-sm text-white/85">
                    Sales History Notes
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                      disabled={isFormDisabled}
                      onChange={(event) => setSalesHistoryNotes(event.target.value)}
                      placeholder="Include previous sales and market behavior."
                      value={salesHistoryNotes}
                    />
                  </label>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-medium">Current Weekly Auction Listings</h3>
                    <button
                      className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isFormDisabled}
                      onClick={addAuctionListing}
                      type="button"
                    >
                      + Add Another Auction Lot
                    </button>
                  </div>

                  <div className="space-y-4">
                    {auctionListings.map((listing, listingIndex) => (
                      <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-4" key={`auction-listing-${listingIndex + 1}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white/90">Auction Listing {listingIndex + 1}</p>
                          {auctionListings.length > 1 ? (
                            <button
                              className="rounded-md border border-red-400/60 px-3 py-1 text-xs text-red-300 transition hover:bg-red-400/10"
                              disabled={isFormDisabled}
                              onClick={() => removeAuctionListing(listingIndex)}
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <label className="block text-sm text-white/85">
                          Lot Title
                          <input
                            className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                            disabled={isFormDisabled}
                            onChange={(event) => updateAuctionListing(listingIndex, { lotTitle: event.target.value })}
                            type="text"
                            value={listing.lotTitle}
                          />
                        </label>
                        <label className="block text-sm text-white/85">
                          Specs
                          <textarea
                            className="mt-1 min-h-24 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                            disabled={isFormDisabled}
                            onChange={(event) => updateAuctionListing(listingIndex, { specs: event.target.value })}
                            value={listing.specs}
                          />
                        </label>
                        <label className="block text-sm text-white/85">
                          Photos
                          <input
                            accept="image/*"
                            className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                            disabled={isFormDisabled || uploadingTarget === `auction-listing-${listingIndex + 1}`}
                            multiple
                            onChange={(event) => void handleAuctionListingPhotosUpload(listingIndex, event.target.files)}
                            type="file"
                          />
                        </label>
                        {listing.photos.length > 0 ? (
                          <div className="flex flex-wrap gap-3">
                            {listing.photos.map((photoPath, photoIndex) => {
                              const previewUrl = photoPreviewUrls[photoPath];
                              const fileName = extractOriginalFileName(photoPath);

                              return (
                                <div className="w-20" key={`${photoPath}-${photoIndex}`}>
                                  <div className="relative h-20 w-20 overflow-hidden rounded-md border border-white/20 bg-black/45">
                                    {previewUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        alt={fileName}
                                        className="h-full w-full object-cover"
                                        src={previewUrl}
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                                        No preview
                                      </div>
                                    )}
                                    <button
                                      aria-label={`Remove ${fileName}`}
                                      className="absolute right-1 top-1 h-5 w-5 rounded-full bg-black/70 text-xs text-white transition hover:bg-red-500"
                                      disabled={isFormDisabled}
                                      onClick={() => removeAuctionListingPhoto(listingIndex, photoIndex)}
                                      type="button"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <p className="mt-1 truncate text-[10px] text-white/70" title={fileName}>
                                    {fileName}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Private Dealer Options</h3>
                  <div className="space-y-3">
                    {dealerOptions.map((option) => (
                      <div className="rounded-lg border border-white/10 bg-black/25" key={`dealer-option-${option.optionNumber}`}>
                        <button
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/90"
                          disabled={isFormDisabled}
                          onClick={() =>
                            updateDealerOption(option.optionNumber, {
                              expanded: !option.expanded,
                            })
                          }
                          type="button"
                        >
                          <span>Option {option.optionNumber}</span>
                          <span>{option.expanded ? "Hide" : "Expand"}</span>
                        </button>

                        {option.expanded ? (
                          <div className="space-y-3 border-t border-white/10 px-4 py-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="text-sm text-white/85">
                                Year
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { year: event.target.value })}
                                  type="text"
                                  value={option.year}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Make
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { make: event.target.value })}
                                  type="text"
                                  value={option.make}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Model
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { model: event.target.value })}
                                  type="text"
                                  value={option.model}
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="text-sm text-white/85">
                                Grade
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { grade: event.target.value })}
                                  type="text"
                                  value={option.grade}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Mileage
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { mileage: event.target.value })}
                                  type="text"
                                  value={option.mileage}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Colour
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { colour: event.target.value })}
                                  type="text"
                                  value={option.colour}
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="text-sm text-white/85">
                                Transmission
                                <div className="mt-1 flex rounded-lg border border-white/20 bg-black/35 p-1">
                                  <button
                                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                                      option.transmission === "Manual"
                                        ? "bg-[#E55125] text-white"
                                        : "text-white/75 hover:bg-white/10"
                                    }`}
                                    disabled={isFormDisabled}
                                    onClick={() => updateDealerOption(option.optionNumber, { transmission: "Manual" })}
                                    type="button"
                                  >
                                    Manual
                                  </button>
                                  <button
                                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                                      option.transmission === "Auto"
                                        ? "bg-[#E55125] text-white"
                                        : "text-white/75 hover:bg-white/10"
                                    }`}
                                    disabled={isFormDisabled}
                                    onClick={() => updateDealerOption(option.optionNumber, { transmission: "Auto" })}
                                    type="button"
                                  >
                                    Auto
                                  </button>
                                </div>
                              </div>
                              <label className="text-sm text-white/85">
                                Trim
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { trim: event.target.value })}
                                  type="text"
                                  value={option.trim}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Dealer Price (JPY)
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  min={0}
                                  onChange={(event) =>
                                    updateDealerOption(option.optionNumber, { dealerPriceJpy: event.target.value })
                                  }
                                  type="number"
                                  value={option.dealerPriceJpy}
                                />
                              </label>
                            </div>

                            <label className="block text-sm text-white/85">
                              Photos
                              <input
                                accept="image/*"
                                className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                                disabled={isFormDisabled || uploadingTarget === `dealer-option-${option.optionNumber}-photos`}
                                multiple
                                onChange={(event) => void handleDealerOptionPhotosUpload(option.optionNumber, event.target.files)}
                                type="file"
                              />
                            </label>

                            <label className="block text-sm text-white/85">
                              Sales Sheet (PDF)
                              <input
                                accept="application/pdf"
                                className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                                disabled={isFormDisabled || uploadingTarget === `dealer-option-${option.optionNumber}-sales-sheet`}
                                onChange={(event) => void handleDealerSalesSheetUpload(option.optionNumber, event.target.files)}
                                type="file"
                              />
                            </label>

                            {option.photos.length > 0 ? (
                              <div className="flex flex-wrap gap-3">
                                {option.photos.map((photoPath, photoIndex) => {
                                  const previewUrl = photoPreviewUrls[photoPath];
                                  const fileName = extractOriginalFileName(photoPath);

                                  return (
                                    <div className="w-20" key={`${option.optionNumber}-${photoPath}-${photoIndex}`}>
                                      <div className="relative h-20 w-20 overflow-hidden rounded-md border border-white/20 bg-black/45">
                                        {previewUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            alt={fileName}
                                            className="h-full w-full object-cover"
                                            src={previewUrl}
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                                            No preview
                                          </div>
                                        )}
                                        <button
                                          aria-label={`Remove ${fileName}`}
                                          className="absolute right-1 top-1 h-5 w-5 rounded-full bg-black/70 text-xs text-white transition hover:bg-red-500"
                                          disabled={isFormDisabled}
                                          onClick={() => removeDealerOptionPhoto(option.optionNumber, photoIndex)}
                                          type="button"
                                        >
                                          ×
                                        </button>
                                      </div>
                                      <p className="mt-1 truncate text-[10px] text-white/70" title={fileName}>
                                        {fileName}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {option.salesSheetUrl ? (
                              <p className="text-xs text-emerald-300">
                                ✅ {extractOriginalFileName(option.salesSheetUrl)} uploaded
                              </p>
                            ) : null}

                            <label className="block text-sm text-white/85">
                              Notes
                              <textarea
                                className="mt-1 min-h-24 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                disabled={isFormDisabled}
                                onChange={(event) => updateDealerOption(option.optionNumber, { notes: event.target.value })}
                                value={option.notes}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Your Recommendation</h3>
                  <label className="block text-sm text-white/85">
                    Overall Notes
                    <textarea
                      className="mt-1 min-h-32 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                      disabled={isFormDisabled}
                      onChange={(event) => setOverallNotes(event.target.value)}
                      value={overallNotes}
                    />
                  </label>
                </div>

                {!isFormReadOnly ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {isEditingSubmittedReport ? (
                      <button
                        className="rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/35 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isFormDisabled}
                        onClick={cancelSentReportEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/35 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isFormDisabled}
                        onClick={() => void resetResearchForm()}
                        type="button"
                      >
                        Reset Form
                      </button>
                    )}
                    <button
                      className="rounded-lg bg-[#E55125] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isFormDisabled || uploadingTarget !== null}
                      onClick={() => void submitResearchReport()}
                      type="button"
                    >
                      {submittingResearch
                        ? "Sending..."
                        : isEditingSubmittedReport
                          ? "Save & Resend Report"
                          : "Send to Customer"}
                    </button>
                  </div>
                ) : null}
                {researchConfirmation && redirectCountdown !== null && redirectCountdown > 0 ? (
                  <p className="text-right text-sm text-emerald-400">
                    ✅ Research submitted successfully. Returning to your dockets in {redirectCountdown} second
                    {redirectCountdown === 1 ? "" : "s"}...
                  </p>
                ) : null}
              </section>
            ) : null}

          </>
        ) : null}
      </div>
    </main>
  );
}

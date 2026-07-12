import { notFound, redirect } from "next/navigation";
import { type User } from "@supabase/supabase-js";

import { getCurrentCustomerSession, SOFT_DELETED_CUSTOMER_MESSAGE } from "@/lib/customer/auth";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export type CustomerDocket = {
  id: string;
  created_at: string | null;
  status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  selected_path: string | null;
  selected_private_dealer_option: number | null;
  chosen_path?: string | null;
  chosen_dealer_index?: number | null;
  approved_at?: string | null;
  agreement_signed: boolean | null;
  deposit_paid: boolean | null;
  report_url_token: string | null;
  questions_url_token: string | null;
};

type UserMetadata = {
  first_name?: unknown;
  last_name?: unknown;
  full_name?: unknown;
  name?: unknown;
};

export type PrivateDealerOption = {
  id: string;
  option_number: number | null;
  year: string | null;
  make: string | null;
  model: string | null;
  grade: string | null;
  mileage: string | null;
  colour: string | null;
  transmission: string | null;
  trim: string | null;
  dealer_price_jpy: number | null;
  dealer_price_cad: number | null;
  photos: unknown;
  sales_sheet_url: string | null;
  marcus_notes: string | null;
  total_delivered_cad: number | null;
};

export type AuctionResearch = {
  id: string;
  created_at: string | null;
  hammer_price_low_jpy: number | null;
  hammer_price_high_jpy: number | null;
  recommended_max_bid_jpy: number | null;
  sales_history_notes: string | null;
  auction_listings: unknown;
};

export type AuctionEstimate = {
  id: string;
  created_at: string | null;
  midpoint_hammer_jpy: number | null;
  midpoint_hammer_cad: number | null;
  total_delivered_estimate_cad: number | null;
};

export type MarcusQuestion = {
  id: string;
  created_at: string | null;
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
};

export type CustomerQuestion = {
  id: string;
  created_at: string | null;
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
};

export type CustomerMessage = {
  id: string;
  from: "JDM Rush" | "You";
  sender: string;
  time: string;
  timestamp: string;
  text: string;
};

export type CustomerPortalContext = {
  user: User;
  dockets: CustomerDocket[];
  selectedDocket: CustomerDocket | null;
  latestDocket: CustomerDocket | null;
  customerName: string;
  unreadCount: number;
};

const DOCKET_SELECT = [
  "id",
  "created_at",
  "status",
  "customer_first_name",
  "customer_last_name",
  "customer_email",
  "customer_phone",
  "vehicle_year",
  "vehicle_make",
  "vehicle_model",
  "vehicle_description",
  "selected_path",
  "selected_private_dealer_option",
  "chosen_path",
  "chosen_dealer_index",
  "approved_at",
  "agreement_signed",
  "deposit_paid",
  "report_url_token",
  "questions_url_token",
].join(", ");

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNameFromMetadata(user: User) {
  const metadata = (user.user_metadata ?? {}) as UserMetadata;
  const first = metadataString(metadata.first_name);
  if (first) return first;

  const display = metadataString(metadata.full_name) ?? metadataString(metadata.name);
  return display?.split(/\s+/).filter(Boolean)[0] ?? null;
}

function buildLoginRedirect(nextPath: string, message?: string) {
  const params = new URLSearchParams({ next: nextPath });
  if (message) {
    params.set("message", message);
  }
  return `/account/login?${params.toString()}`;
}

function hasCustomerAction(docket: CustomerDocket) {
  return docket.status === "report_sent" || docket.status === "questions_sent";
}

export function getDocketIdParam(searchParams: Record<string, string | string[] | undefined> | undefined) {
  const raw = searchParams?.docket;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

export async function getCustomerPortalContext({
  nextPath,
  selectedDocketId,
  requireDocket = false,
}: {
  nextPath: string;
  selectedDocketId?: string | null;
  requireDocket?: boolean;
}): Promise<CustomerPortalContext> {
  const session = await getCurrentCustomerSession();

  if (!session.isCustomer || !session.user) {
    redirect(buildLoginRedirect(nextPath, session.disabled ? SOFT_DELETED_CUSTOMER_MESSAGE : undefined));
  }

  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("dockets")
    .select(DOCKET_SELECT)
    .order("created_at", { ascending: false })
    .returns<CustomerDocket[]>();

  if (error) {
    throw new Error(error.message);
  }

  const dockets = data ?? [];
  const latestDocket = dockets[0] ?? null;
  const selectedDocket = selectedDocketId
    ? dockets.find((docket) => docket.id === selectedDocketId) ?? null
    : latestDocket;

  if (selectedDocketId && !selectedDocket) {
    notFound();
  }

  if (requireDocket && !selectedDocket) {
    notFound();
  }

  const nameFromDocket = latestDocket?.customer_first_name?.trim() || null;
  const customerName = getNameFromMetadata(session.user) ?? nameFromDocket ?? "there";
  const unreadCount = dockets.filter(hasCustomerAction).length;

  return {
    user: session.user,
    dockets,
    selectedDocket,
    latestDocket,
    customerName,
    unreadCount,
  };
}

export function getVehicleLabel(docket: CustomerDocket | null | undefined) {
  if (!docket) return "Your JDM import";

  const explicit = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (explicit.length > 0) {
    return explicit.join(" ");
  }

  return docket.vehicle_description?.trim() || "Your JDM import";
}

export function getDocketHref(path: string, docketId: string | null | undefined) {
  return docketId ? `${path}?docket=${encodeURIComponent(docketId)}` : path;
}

export function isPurchaseUnlocked(docket: CustomerDocket) {
  return docket.status === "decision_made" || Boolean(docket.agreement_signed || docket.deposit_paid || docket.approved_at);
}

export function isShippingUnlocked(docket: CustomerDocket) {
  return Boolean(docket.agreement_signed && docket.deposit_paid);
}

export function getCardStatus(docket: CustomerDocket): {
  statusLabel: string;
  statusColor: "orange" | "amber";
  activeSection: number;
  progressLabel: string;
} {
  if (docket.status === "sold_in_delivery") {
    return {
      statusLabel: "Purchase complete — moving to delivery",
      statusColor: "amber",
      activeSection: 3,
      progressLabel: "Delivery stage",
    };
  }

  if (isShippingUnlocked(docket)) {
    return {
      statusLabel: "Purchase complete — journey pending",
      statusColor: "amber",
      activeSection: 3,
      progressLabel: "Shipping tracker",
    };
  }

  if (isPurchaseUnlocked(docket)) {
    return {
      statusLabel: docket.agreement_signed ? "Deposit payment pending" : "Purchase docs pending",
      statusColor: "orange",
      activeSection: 2,
      progressLabel: "Purchase stage",
    };
  }

  if (docket.status === "report_sent") {
    return {
      statusLabel: "Report ready — action needed",
      statusColor: "orange",
      activeSection: 1,
      progressLabel: "Research stage",
    };
  }

  if (docket.status === "questions_sent") {
    return {
      statusLabel: "Questions waiting for you",
      statusColor: "orange",
      activeSection: 1,
      progressLabel: "Research stage",
    };
  }

  return {
    statusLabel: "Research in progress",
    statusColor: "amber",
    activeSection: 1,
    progressLabel: "Research stage",
  };
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatMessageTime(value: string | null | undefined) {
  const short = formatShortDate(value);
  return short ? short.replace(/, \d{4}$/, "") : "Today";
}

export async function getResearchData(docketId: string) {
  const supabase = await createServerAuthClient();
  const [{ data: dealerOptions, error: dealerError }, { data: auctionResearch, error: researchError }, { data: auctionEstimate, error: estimateError }] =
    await Promise.all([
      supabase
        .from("private_dealer_options")
        .select("id, option_number, year, make, model, grade, mileage, colour, transmission, trim, dealer_price_jpy, dealer_price_cad, photos, sales_sheet_url, marcus_notes, total_delivered_cad")
        .eq("docket_id", docketId)
        .order("option_number", { ascending: true })
        .returns<PrivateDealerOption[]>(),
      supabase
        .from("auction_research")
        .select("id, created_at, hammer_price_low_jpy, hammer_price_high_jpy, recommended_max_bid_jpy, sales_history_notes, auction_listings")
        .eq("docket_id", docketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionResearch>(),
      supabase
        .from("auction_estimate")
        .select("id, created_at, midpoint_hammer_jpy, midpoint_hammer_cad, total_delivered_estimate_cad")
        .eq("docket_id", docketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionEstimate>(),
    ]);

  const error = dealerError ?? researchError ?? estimateError;
  if (error) {
    throw new Error(error.message);
  }

  return {
    dealerOptions: dealerOptions ?? [],
    auctionResearch: auctionResearch ?? null,
    auctionEstimate: auctionEstimate ?? null,
  };
}

export async function getAgreementSentAt(docketId: string) {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("dockets")
    .select("agreement_sent_at")
    .eq("id", docketId)
    .maybeSingle<{ agreement_sent_at: string | null }>();

  if (error) {
    const message = error.message.toLowerCase();
    if (error.code === "42703" || message.includes("agreement_sent_at") || message.includes("does not exist")) {
      return null;
    }
    throw new Error(error.message);
  }

  return data?.agreement_sent_at ?? null;
}

export async function getMessageThread(docketId: string) {
  const supabase = await createServerAuthClient();
  const [{ data: marcusQuestions, error: marcusError }, { data: customerQuestions, error: customerError }] =
    await Promise.all([
      supabase
        .from("marcus_questions")
        .select("id, created_at, question_text, answer_text, answered_at")
        .eq("docket_id", docketId)
        .order("created_at", { ascending: true })
        .returns<MarcusQuestion[]>(),
      supabase
        .from("customer_questions")
        .select("id, created_at, question_text, answer_text, answered_at")
        .eq("docket_id", docketId)
        .order("created_at", { ascending: true })
        .returns<CustomerQuestion[]>(),
    ]);

  const error = marcusError ?? customerError;
  if (error) {
    throw new Error(error.message);
  }

  const messages: CustomerMessage[] = [];

  for (const question of marcusQuestions ?? []) {
    if (question.question_text?.trim()) {
      messages.push({
        id: `marcus-question-${question.id}`,
        from: "JDM Rush",
        sender: "Marcus",
        time: formatMessageTime(question.created_at),
        timestamp: question.created_at ?? new Date(0).toISOString(),
        text: question.question_text.trim(),
      });
    }

    if (question.answer_text?.trim()) {
      messages.push({
        id: `marcus-answer-${question.id}`,
        from: "You",
        sender: "You",
        time: formatMessageTime(question.answered_at ?? question.created_at),
        timestamp: question.answered_at ?? question.created_at ?? new Date(0).toISOString(),
        text: question.answer_text.trim(),
      });
    }
  }

  for (const question of customerQuestions ?? []) {
    if (question.question_text?.trim()) {
      messages.push({
        id: `customer-question-${question.id}`,
        from: "You",
        sender: "You",
        time: formatMessageTime(question.created_at),
        timestamp: question.created_at ?? new Date(0).toISOString(),
        text: question.question_text.trim(),
      });
    }

    if (question.answer_text?.trim()) {
      messages.push({
        id: `customer-answer-${question.id}`,
        from: "JDM Rush",
        sender: "Marcus",
        time: formatMessageTime(question.answered_at ?? question.created_at),
        timestamp: question.answered_at ?? question.created_at ?? new Date(0).toISOString(),
        text: question.answer_text.trim(),
      });
    }
  }

  return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

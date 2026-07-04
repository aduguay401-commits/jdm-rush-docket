import "server-only";

import { createHash } from "node:crypto";

import { createServerClient } from "@/lib/supabase/server";

export const CASL_SENDER_IDENTITY =
  "JDM Rush Imports Inc. | 11 Humboldt Ave, Winnipeg, MB R3B 0S5, Canada | support@jdmrushimports.ca";

export const CASL_ADDRESS_CONFIRMATION_NOTE =
  "Postal address from agreement templates; Adam to confirm before broad marketing send.";

type HeaderReader = {
  get(name: string): string | null;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __nurtureTokenLookupRateLimit?: Map<string, RateEntry>;
};

const rateLimitStore =
  globalForRateLimit.__nurtureTokenLookupRateLimit ?? new Map<string, RateEntry>();
globalForRateLimit.__nurtureTokenLookupRateLimit = rateLimitStore;

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 80;

export type NurtureLeadContext = {
  token: string;
  docket: {
    id: string;
    customer_email: string;
    vehicle_year: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_description: string | null;
    destination_city: string | null;
    marketing_consent: boolean;
    marketing_consent_granted_at: string | null;
    marketing_unsubscribed_at: string | null;
  };
  savedSearch: {
    id: string;
    anchor_ref: string | null;
    anchor_year: number | null;
    anchor_make: string | null;
    anchor_model: string | null;
    anchor_price_jpy: number | null;
    anchor_card_estimate_cad: number | null;
    active: boolean;
  };
};

type ConsentRequestMeta = {
  ip_hash: string | null;
  user_agent: string | null;
};

function getHeader(headers: HeaderReader | null, name: string): string | null {
  return headers?.get(name) ?? null;
}

function getClientIp(headers: HeaderReader | null): string | null {
  const forwardedFor = getHeader(headers, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return getHeader(headers, "x-real-ip");
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isNurtureTokenShape(token: string): boolean {
  return TOKEN_RE.test(token);
}

export function checkNurtureTokenLookupRateLimit(
  scope: string,
  headers: HeaderReader | null,
): boolean {
  const ip = getClientIp(headers) ?? "unknown";
  const key = `${scope}:${hashValue(`nurture-rate:${ip}`)}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}

export function getConsentRequestMeta(headers: HeaderReader | null): ConsentRequestMeta {
  const ip = getClientIp(headers);
  const userAgent = getHeader(headers, "user-agent");

  return {
    ip_hash: ip ? hashValue(`nurture-consent:${ip}`) : null,
    user_agent: userAgent ? userAgent.slice(0, 500) : null,
  };
}

export function vehicleLabelForLead(lead: NurtureLeadContext): string {
  return [lead.savedSearch.anchor_year, lead.savedSearch.anchor_make, lead.savedSearch.anchor_model]
    .filter((value) => value !== null && String(value).trim().length > 0)
    .join(" ") ||
    [lead.docket.vehicle_year, lead.docket.vehicle_make, lead.docket.vehicle_model]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ") ||
    lead.docket.vehicle_description ||
    "your quoted vehicle";
}

export function formatCadAmount(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `$${Math.round(value).toLocaleString("en-CA")} CAD`;
}

export async function fetchNurtureLeadByToken(token: string): Promise<NurtureLeadContext | null> {
  if (!isNurtureTokenShape(token)) {
    return null;
  }

  const supabase = createServerClient();
  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select(
      "id, customer_email, vehicle_year, vehicle_make, vehicle_model, vehicle_description, destination_city, marketing_consent, marketing_consent_granted_at, marketing_unsubscribed_at"
    )
    .eq("marketing_unsubscribe_token", token)
    .eq("lead_source", "exact_quote")
    .maybeSingle<NurtureLeadContext["docket"]>();

  if (docketError || !docket || !docket.customer_email) {
    return null;
  }

  const { data: savedSearch, error: savedSearchError } = await supabase
    .from("lead_saved_searches")
    .select(
      "id, anchor_ref, anchor_year, anchor_make, anchor_model, anchor_price_jpy, anchor_card_estimate_cad, active"
    )
    .eq("docket_id", docket.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<NurtureLeadContext["savedSearch"]>();

  if (savedSearchError || !savedSearch) {
    return null;
  }

  return { token, docket, savedSearch };
}

export function isLeadOptedIn(lead: NurtureLeadContext): boolean {
  return Boolean(
    lead.docket.marketing_consent &&
      !lead.docket.marketing_unsubscribed_at &&
      lead.savedSearch.active,
  );
}

export async function recordLeadOptIn(
  token: string,
  meta: ConsentRequestMeta,
): Promise<NurtureLeadContext | null> {
  const lead = await fetchNurtureLeadByToken(token);
  if (!lead) {
    return null;
  }

  if (isLeadOptedIn(lead)) {
    return lead;
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const eventType = lead.docket.marketing_unsubscribed_at ? "resubscribe" : "opt_in";

  const { error: eventInsertError } = await supabase.from("lead_consent_events").insert({
    docket_id: lead.docket.id,
    event_type: eventType,
    event_source: "quote_email_optin",
    email: lead.docket.customer_email,
    ip_hash: meta.ip_hash,
    user_agent: meta.user_agent,
    token,
    metadata: {
      saved_search_id: lead.savedSearch.id,
      vehicle: vehicleLabelForLead(lead),
    },
  });

  if (eventInsertError) {
    return null;
  }

  const { error: docketUpdateError } = await supabase
    .from("dockets")
    .update({
      marketing_consent: true,
      marketing_consent_granted_at: now,
      marketing_consent_source: "quote_email_optin",
      marketing_unsubscribed_at: null,
    })
    .eq("id", lead.docket.id);

  if (docketUpdateError) {
    return null;
  }

  const { error: savedSearchUpdateError } = await supabase
    .from("lead_saved_searches")
    .update({ active: true })
    .eq("id", lead.savedSearch.id);

  if (savedSearchUpdateError) {
    return null;
  }

  return fetchNurtureLeadByToken(token);
}

export async function recordLeadUnsubscribe(
  token: string,
  meta: ConsentRequestMeta,
): Promise<NurtureLeadContext | null> {
  const lead = await fetchNurtureLeadByToken(token);
  if (!lead) {
    return null;
  }

  const alreadySuppressed = Boolean(
    lead.docket.marketing_unsubscribed_at && !lead.savedSearch.active,
  );
  if (alreadySuppressed) {
    return lead;
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { error: docketUpdateError } = await supabase
    .from("dockets")
    .update({
      marketing_consent: false,
      marketing_unsubscribed_at: now,
    })
    .eq("id", lead.docket.id);

  if (docketUpdateError) {
    return null;
  }

  const { error: savedSearchUpdateError } = await supabase
    .from("lead_saved_searches")
    .update({ active: false })
    .eq("id", lead.savedSearch.id);

  if (savedSearchUpdateError) {
    return null;
  }

  const { error: eventInsertError } = await supabase.from("lead_consent_events").insert({
    docket_id: lead.docket.id,
    event_type: "unsubscribe",
    event_source: "weekly_email_unsubscribe",
    email: lead.docket.customer_email,
    ip_hash: meta.ip_hash,
    user_agent: meta.user_agent,
    token,
    metadata: {
      saved_search_id: lead.savedSearch.id,
      vehicle: vehicleLabelForLead(lead),
    },
  });

  if (eventInsertError) {
    return null;
  }

  return fetchNurtureLeadByToken(token);
}

export function buildAnchorModelKey(make: string | null, model: string | null): string | null {
  const parts = [make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean);

  return parts.length > 0 ? parts.join(":") : null;
}

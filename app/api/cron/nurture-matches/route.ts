import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import {
  fetchJapanStockInventory,
  type JapanStockInventoryRow,
} from "@/lib/inventory/japanStock";
import {
  matchLeadSavedSearchToJapanStockInventory,
  type LeadSavedSearchAnchor,
  type NurtureMatchCandidate,
} from "@/lib/nurture/matching";
import { renderWeeklyMatchesEmail } from "@/lib/emails/weeklyMatches";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEND_WINDOW_MS = 6 * DAY_MS;
const DEV_MODE = process.env.DEV_MODE === "true";
const MAX_MATCHES = 3;

type NurtureSendStatus =
  | "sent"
  | "skipped_insufficient_matches"
  | "skipped_unsubscribed"
  | "failed";

type DocketForNurture = {
  id: string;
  customer_email: string | null;
  customer_first_name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  marketing_consent: boolean | null;
  marketing_unsubscribed_at: string | null;
  marketing_unsubscribe_token: string | null;
};

type SavedSearchRow = LeadSavedSearchAnchor & {
  id: string;
  last_sent_at: string | null;
  dockets: DocketForNurture | DocketForNurture[] | null;
};

type InventoryRef = {
  source: "japan_stock";
  ref: string;
  url: string;
  tier: NurtureMatchCandidate["tier"];
};

type CronCounters = {
  processed: number;
  sent: number;
  skipped_insufficient_matches: number;
  skipped_recently_sent: number;
  skipped_unsubscribed: number;
  failed: number;
};

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getJoinedDocket(row: SavedSearchRow): DocketForNurture | null {
  if (Array.isArray(row.dockets)) {
    return row.dockets[0] ?? null;
  }
  return row.dockets ?? null;
}

function buildAnchorVehicleLabel(row: SavedSearchRow, docket: DocketForNurture): string {
  return (
    [row.anchor_year, row.anchor_make, row.anchor_model]
      .filter((value) => value !== null && String(value).trim().length > 0)
      .join(" ") ||
    [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
      .map((value) => nonEmpty(value))
      .filter((value): value is string => Boolean(value))
      .join(" ") ||
    nonEmpty(docket.vehicle_description) ||
    "your quoted vehicle"
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000);
  return String(error).slice(0, 1000);
}

function bareEmailAddress(value: string): string {
  const bracketMatch = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1];

  const trimmed = value.trim().replace(/^mailto:/i, "");
  const plainMatch = trimmed.match(/[^\s<>]+@[^\s<>]+/);
  return plainMatch?.[0] ?? trimmed;
}

function getFirstImageUrl(row: JapanStockInventoryRow | undefined): string | null {
  const firstImage = row?.images[0];
  if (typeof firstImage === "string" && firstImage.trim().length > 0) {
    return firstImage.trim();
  }
  if (typeof firstImage === "object" && firstImage !== null && !Array.isArray(firstImage)) {
    const image = firstImage as Record<string, unknown>;
    for (const key of ["card", "src", "gallery", "url"]) {
      const candidate = image[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }
  return null;
}

function buildInventoryRefs(matches: NurtureMatchCandidate[]): InventoryRef[] {
  return matches.slice(0, MAX_MATCHES).map((match) => ({
    source: "japan_stock",
    ref: match.ref,
    url: match.url,
    tier: match.tier,
  }));
}

async function insertNurtureSend(
  supabase: SupabaseClient,
  row: {
    saved_search_id: string;
    docket_id: string;
    recipient_email: string;
    status: NurtureSendStatus;
    subject?: string | null;
    inventory_refs?: InventoryRef[];
    match_config?: Record<string, unknown>;
    error?: string | null;
    sent_at?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("nurture_email_sends").insert({
    saved_search_id: row.saved_search_id,
    docket_id: row.docket_id,
    recipient_email: row.recipient_email,
    status: row.status,
    subject: row.subject ?? null,
    inventory_refs: row.inventory_refs ?? [],
    match_config: row.match_config ?? {},
    error: row.error ?? null,
    sent_at: row.sent_at ?? null,
  });

  if (error) {
    console.error("[Nurture Matches] nurture_email_sends insert failed", {
      savedSearchId: row.saved_search_id,
      docketId: row.docket_id,
      status: row.status,
      error,
    });
  }
}

function createServiceRoleClient(): SupabaseClient | Response {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration is missing" }, { status: 500 });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function handleNurtureMatchesCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!fromEmail || (DEV_MODE && !adminEmail)) {
    return Response.json({ error: "Email configuration is missing" }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  if (supabase instanceof Response) {
    return supabase;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - SEND_WINDOW_MS).toISOString();
  const counters: CronCounters = {
    processed: 0,
    sent: 0,
    skipped_insufficient_matches: 0,
    skipped_recently_sent: 0,
    skipped_unsubscribed: 0,
    failed: 0,
  };

  const { data: savedSearches, error: savedSearchesError } = await supabase
    .from("lead_saved_searches")
    .select(
      `id, docket_id, email, anchor_ref, anchor_url, anchor_year, anchor_make, anchor_model, anchor_model_key, anchor_price_jpy, anchor_card_estimate_cad, anchor_duty_type, destination_city, price_band_percent, fallback_price_band_percent, year_window, fallback_year_window, max_matches, active, last_sent_at, dockets!inner(id, customer_email, customer_first_name, vehicle_year, vehicle_make, vehicle_model, vehicle_description, marketing_consent, marketing_unsubscribed_at, marketing_unsubscribe_token)`,
    )
    .eq("active", true)
    .eq("dockets.marketing_consent", true)
    .is("dockets.marketing_unsubscribed_at", null)
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoffIso}`)
    .order("created_at", { ascending: true });

  if (savedSearchesError) {
    return Response.json({ error: savedSearchesError.message }, { status: 500 });
  }

  let leads = (savedSearches ?? []) as SavedSearchRow[];
  if (leads.length === 0) {
    return Response.json({ message: "No due nurture matches", ...counters });
  }

  const savedSearchIds = leads.map((lead) => lead.id);
  const { data: recentSentRows, error: recentSentError } = await supabase
    .from("nurture_email_sends")
    .select("saved_search_id")
    .in("saved_search_id", savedSearchIds)
    .eq("status", "sent")
    .gte("created_at", cutoffIso);

  if (recentSentError) {
    return Response.json({ error: recentSentError.message }, { status: 500 });
  }

  const recentlySentSavedSearchIds = new Set(
    ((recentSentRows ?? []) as { saved_search_id: string | null }[])
      .map((row) => row.saved_search_id)
      .filter((id): id is string => Boolean(id)),
  );
  leads = leads.filter((lead) => !recentlySentSavedSearchIds.has(lead.id));
  counters.skipped_recently_sent = savedSearchIds.length - leads.length;

  if (leads.length === 0) {
    return Response.json({ message: "No due nurture matches", ...counters });
  }

  const [inventory, exchange] = await Promise.all([
    fetchJapanStockInventory(),
    fetchJPYtoCAD(),
  ]);
  const inventoryByRef = new Map(inventory.map((row) => [row.ref, row]));

  for (const lead of leads) {
    counters.processed += 1;
    const docket = getJoinedDocket(lead);
    const originalRecipient = nonEmpty(lead.email) ?? nonEmpty(docket?.customer_email) ?? null;
    const recipientEmail = DEV_MODE ? adminEmail! : originalRecipient;

    if (!docket || !originalRecipient || !recipientEmail) {
      counters.failed += 1;
      continue;
    }

    if (!docket.marketing_consent || docket.marketing_unsubscribed_at) {
      counters.skipped_unsubscribed += 1;
      await insertNurtureSend(supabase, {
        saved_search_id: lead.id,
        docket_id: lead.docket_id,
        recipient_email: originalRecipient,
        status: "skipped_unsubscribed",
      });
      continue;
    }

    try {
      const selection = matchLeadSavedSearchToJapanStockInventory(
        lead,
        inventory,
        exchange.rate,
      );
      const matches = selection.matches.slice(0, MAX_MATCHES);
      const inventoryRefs = buildInventoryRefs(matches);
      const matchConfig = selection.match_config as unknown as Record<string, unknown>;

      if (selection.status !== "matched" || matches.length < MAX_MATCHES) {
        counters.skipped_insufficient_matches += 1;
        await insertNurtureSend(supabase, {
          saved_search_id: lead.id,
          docket_id: lead.docket_id,
          recipient_email: originalRecipient,
          status: "skipped_insufficient_matches",
          inventory_refs: inventoryRefs,
          match_config: matchConfig,
        });
        continue;
      }

      const unsubscribeToken = nonEmpty(docket.marketing_unsubscribe_token);
      if (!unsubscribeToken) {
        throw new Error("Missing marketing unsubscribe token");
      }

      const anchorVehicleLabel = buildAnchorVehicleLabel(lead, docket);
      const email = renderWeeklyMatchesEmail({
        anchorVehicleLabel,
        unsubscribeToken,
        devMode: DEV_MODE,
        originalRecipient,
        matches: matches.map((match) => ({
          ...match,
          imageUrl: getFirstImageUrl(inventoryByRef.get(match.ref)),
        })),
      });

      const sendResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
        listUnsubscribe: {
          url: email.unsubscribeUrl,
          mailto: bareEmailAddress(fromEmail),
          oneClick: true,
        },
      });

      if (sendResult.error) {
        throw sendResult.error;
      }

      await insertNurtureSend(supabase, {
        saved_search_id: lead.id,
        docket_id: lead.docket_id,
        recipient_email: originalRecipient,
        status: "sent",
        subject: email.subject,
        inventory_refs: inventoryRefs,
        match_config: matchConfig,
        sent_at: nowIso,
      });

      if (!DEV_MODE) {
        const { error: savedSearchUpdateError } = await supabase
          .from("lead_saved_searches")
          .update({ last_sent_at: nowIso })
          .eq("id", lead.id);

        const { error: docketUpdateError } = await supabase
          .from("dockets")
          .update({ marketing_last_email_at: nowIso })
          .eq("id", lead.docket_id);

        if (savedSearchUpdateError || docketUpdateError) {
          console.error("[Nurture Matches] post-send suppression write failed", {
            savedSearchId: lead.id,
            docketId: lead.docket_id,
            savedSearchUpdateError,
            docketUpdateError,
          });
          counters.failed += 1;
          continue;
        }
      }

      const { error: emailLogError } = await supabase.from("email_log").insert({
        docket_id: lead.docket_id,
        email_type: "weekly_matches",
        recipient_email: recipientEmail,
        subject: email.subject,
        body_snapshot: email.html,
      });

      if (emailLogError) {
        console.error("[Nurture Matches] email_log insert failed", {
          savedSearchId: lead.id,
          docketId: lead.docket_id,
          emailLogError,
        });
        counters.failed += 1;
        continue;
      }

      counters.sent += 1;
    } catch (error) {
      counters.failed += 1;
      await insertNurtureSend(supabase, {
        saved_search_id: lead.id,
        docket_id: lead.docket_id,
        recipient_email: originalRecipient,
        status: "failed",
        error: errorMessage(error),
      });
    }
  }

  return Response.json({
    message: `Processed ${counters.processed} nurture saved search(es)`,
    dev_mode: DEV_MODE,
    recipient_override: DEV_MODE ? adminEmail : null,
    ...counters,
  });
}

export async function GET(request: Request) {
  return handleNurtureMatchesCron(request);
}

export async function POST(request: Request) {
  return handleNurtureMatchesCron(request);
}

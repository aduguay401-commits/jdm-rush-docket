import "server-only";

import { createServerClient } from "@/lib/supabase/server";

// ── Single source of truth for the tunable numbers ──────────────────────────
export const INTAKE_GUARDRAILS = {
  /** Layer 2: max submissions per rolling hour per IP across intake endpoints. */
  IP_HOURLY: 5,
  /** Layer 3: max NEW dockets per normalized email per rolling 24h; beyond => note-append. */
  EMAIL_DAILY_DOCKETS: 4,
  /** Layer 4: max welcome/quote emails per normalized address per rolling 24h. */
  EMAIL_DAILY_WELCOME: 2,
  /** Layer 1: minimum plausible human fill time (submit - render), in seconds. */
  MIN_FILL_SECONDS: 3,
} as const;

// Customer-facing intake/welcome email types counted by Layer 4. Internal
// notifications (marcus/admin) are deliberately excluded — capping them would
// blind the team.
export const WELCOME_EMAIL_TYPES = ["email_1_customer_welcome", "quote_exact_estimate"] as const;

// Field names shared by contract with the two public site forms. Kept as string
// literals because the site lives in a separate repo and cannot import this file.
export const HONEYPOT_FIELD = "company_website";
export const RENDER_TS_FIELD = "form_rendered_at";

type SupabaseServerClient = ReturnType<typeof createServerClient>;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

// Escape LIKE/ILIKE metacharacters so an email's local part (which may legally
// contain `_`) is matched literally rather than as a wildcard.
function escapeIlike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ── Layer 1: honeypot + fill-time ───────────────────────────────────────────
// A filled honeypot, or a submit that lands < MIN_FILL_SECONDS after render, is
// a bot. A NEGATIVE elapsed means the client clock is ahead of the server (skew)
// — ambiguous, so we DO NOT discard (fail-open on skew, never punish a real user).
export function detectHoneypotOrTooFast(
  body: Record<string, unknown>,
  now: number = Date.now(),
): { discard: boolean; reason: "honeypot" | "too_fast" | null } {
  if (toTrimmedString(body[HONEYPOT_FIELD])) {
    return { discard: true, reason: "honeypot" };
  }

  const renderedAt = toEpochMs(body[RENDER_TS_FIELD]);
  if (renderedAt != null) {
    const elapsedSeconds = (now - renderedAt) / 1000;
    if (elapsedSeconds >= 0 && elapsedSeconds < INTAKE_GUARDRAILS.MIN_FILL_SECONDS) {
      return { discard: true, reason: "too_fast" };
    }
  }

  return { discard: false, reason: null };
}

// ── Layer 2: per-IP rate limit ──────────────────────────────────────────────
// The docket endpoints are called by the site proxy, which forwards the real
// client IP in x-intake-client-ip. Fall back to platform headers for direct hits.
export function getIntakeClientIp(request: Request): string | null {
  const forwardedByProxy = toTrimmedString(request.headers.get("x-intake-client-ip"));
  if (forwardedByProxy) {
    return forwardedByProxy;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  return toTrimmedString(request.headers.get("x-real-ip"));
}

// Returns true only when the IP is over the limit. FAIL-OPEN: a missing IP, a
// missing intake_events table, or any query error => false (never block, never throw).
export async function isIpRateLimited(
  supabase: SupabaseServerClient,
  ip: string | null,
  endpoint: string,
  email: string | null,
): Promise<boolean> {
  if (!ip) {
    return false;
  }

  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("intake_events")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", hourAgo);

    if (error) {
      console.warn("[Guardrail L2] intake_events unavailable — skipping IP rate limit:", error.message);
      return false;
    }

    if ((count ?? 0) >= INTAKE_GUARDRAILS.IP_HOURLY) {
      return true;
    }

    const { error: insertError } = await supabase
      .from("intake_events")
      .insert({ ip, email, endpoint });

    if (insertError) {
      console.warn("[Guardrail L2] intake_events insert failed (non-blocking):", insertError.message);
    }

    return false;
  } catch (error) {
    console.warn("[Guardrail L2] unexpected error — skipping IP rate limit:", error);
    return false;
  }
}

// ── Layer 3: per-email daily docket cap ─────────────────────────────────────
// Count NEW dockets for this normalized email in the last 24h. Returns null on
// error, which the caller treats as "under cap" (fail-open — never block a real
// customer because the count query hiccupped).
export async function countRecentDocketsForEmail(
  supabase: SupabaseServerClient,
  normalizedEmail: string,
): Promise<number | null> {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("dockets")
      .select("customer_email")
      .ilike("customer_email", escapeIlike(normalizedEmail))
      .gte("created_at", dayAgo);

    if (error) {
      console.warn("[Guardrail L3] docket count query failed — allowing:", error.message);
      return null;
    }

    return (data ?? []).filter((row) => normalizeEmail(row.customer_email) === normalizedEmail).length;
  } catch (error) {
    console.warn("[Guardrail L3] unexpected error — allowing:", error);
    return null;
  }
}

// Append a note to the NEWEST existing docket for this email. Best-effort — any
// failure is logged and swallowed. Returns the docket id it wrote to, or null.
export async function appendNoteToNewestDocketForEmail(
  supabase: SupabaseServerClient,
  normalizedEmail: string,
  note: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("dockets")
      .select("id, additional_notes, customer_email, created_at")
      .ilike("customer_email", escapeIlike(normalizedEmail))
      .order("created_at", { ascending: false })
      .limit(25);

    if (error || !data) {
      console.warn("[Guardrail L3] newest-docket lookup failed — note not appended:", error?.message);
      return null;
    }

    const newest = data.find((row) => normalizeEmail(row.customer_email) === normalizedEmail);
    if (!newest) {
      return null;
    }

    const existing = typeof newest.additional_notes === "string" ? newest.additional_notes : "";
    const updatedNotes = existing ? `${existing}\n\n${note}` : note;

    const { error: updateError } = await supabase
      .from("dockets")
      .update({ additional_notes: updatedNotes })
      .eq("id", newest.id);

    if (updateError) {
      console.warn("[Guardrail L3] note append update failed:", updateError.message);
      return null;
    }

    return newest.id as string;
  } catch (error) {
    console.warn("[Guardrail L3] unexpected error appending note:", error);
    return null;
  }
}

// ── Layer 4: welcome-email send cap ─────────────────────────────────────────
// Returns true when the address is UNDER the cap (safe to send). FAIL-OPEN: any
// error => true (degrade to today's behavior — send — rather than silently drop
// a real customer's email).
export async function isUnderWelcomeEmailCap(
  supabase: SupabaseServerClient,
  normalizedEmail: string | null,
): Promise<boolean> {
  if (!normalizedEmail) {
    return true;
  }

  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .ilike("recipient_email", escapeIlike(normalizedEmail))
      .in("email_type", [...WELCOME_EMAIL_TYPES])
      .gte("sent_at", dayAgo);

    if (error) {
      console.warn("[Guardrail L4] email_log count failed — allowing send:", error.message);
      return true;
    }

    return (count ?? 0) < INTAKE_GUARDRAILS.EMAIL_DAILY_WELCOME;
  } catch (error) {
    console.warn("[Guardrail L4] unexpected error — allowing send:", error);
    return true;
  }
}

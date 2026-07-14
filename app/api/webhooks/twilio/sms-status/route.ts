import Twilio from "twilio";

import { createServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/urls";

export const runtime = "nodejs";

// POST /api/webhooks/twilio/sms-status — Twilio delivery status callback.
// This is a PUBLIC endpoint, so every request MUST carry a valid Twilio signature;
// unsigned / invalid requests are rejected 403. On a valid callback we update the
// matching sms_log row (by MessageSid) with the delivery status — this is what
// catches async carrier failures (e.g. 30034) that never surface at send time.
export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[SMS webhook] TWILIO_AUTH_TOKEN missing — cannot validate signature");
    return new Response("Forbidden", { status: 403 });
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  // Must match the exact statusCallback URL Twilio signed (set in sendSMS).
  const url = `${getAppBaseUrl()}/api/webhooks/twilio/sms-status`;

  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    params[key] = value;
  }

  if (!Twilio.validateRequest(authToken, signature, url, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const sid = params.MessageSid || params.SmsSid || null;
  const status = params.MessageStatus || params.SmsStatus || null;

  // Handled but nothing to do — always 200 so Twilio doesn't retry-storm.
  if (!sid || !status) {
    return new Response(null, { status: 200 });
  }

  const errorCode = params.ErrorCode || null;

  try {
    const supabase = createServerClient();
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (errorCode) {
      updates.error_code = errorCode;
    }
    // Unknown SID -> 0 rows updated -> silent no-op.
    const { error } = await supabase.from("sms_log").update(updates).eq("twilio_sid", sid);
    if (error) {
      console.warn("[SMS webhook] sms_log update skipped:", error.message);
    }
  } catch (updateError) {
    console.warn("[SMS webhook] sms_log update failed (non-blocking):", updateError);
  }

  return new Response(null, { status: 200 });
}

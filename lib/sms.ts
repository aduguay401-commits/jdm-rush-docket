// Twilio SMS notification utilities for JDM Rush Docket

import Twilio from 'twilio';

import { createServerClient } from '@/lib/supabase/server';
import { getAppBaseUrl } from '@/lib/urls';

/**
 * Normalize a North American phone number to E.164 format (+1XXXXXXXXXX).
 * Handles: "2042304683", "12042304683", "+12042304683", "(204) 230-4683", etc.
 * Returns null if the number can't be normalized.
 */
export function normalizePhoneToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already in E.164? Accept it.
  if (raw.startsWith('+') && /^\+\d{7,15}$/.test(raw)) {
    return raw;
  }

  return null;
}

export type SendSMSContext = {
  docketId?: string | null;
  smsType?: string;
};

type SmsLogRow = {
  docket_id: string | null;
  sms_type: string;
  to_last4: string | null;
  body: string | null;
  twilio_sid: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
};

// Fail-open sms_log write. NEVER throws into the caller and never blocks the send.
// If sms_log is absent (migration 017 not yet run) or any error occurs, degrade to
// console.log exactly as before.
async function logSms(row: SmsLogRow): Promise<void> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from('sms_log').insert(row);
    if (error) {
      console.log(
        `[SMS] log skipped (${row.status}${row.error_code ? ' ' + row.error_code : ''}) — sms_log unavailable:`,
        error.message,
      );
    }
  } catch (logError) {
    console.log('[SMS] log write failed (non-blocking):', logError);
  }
}

function last4Of(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

const twilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn('[SMS] Twilio credentials missing — SMS disabled');
    return null;
  }
  return Twilio(sid, token);
};

/**
 * Send a single SMS and record the outcome in sms_log. Returns true on a successful
 * hand-off to Twilio, false otherwise. Never throws. A statusCallback is registered
 * so async carrier delivery status (delivered/undelivered/failed, e.g. 30034) updates
 * the row later via the webhook.
 */
export async function sendSMS(to: string, body: string, context: SendSMSContext = {}): Promise<boolean> {
  const docketId = context.docketId ?? null;
  const smsType = context.smsType ?? 'unknown';

  const client = twilioClient();
  if (!client) {
    await logSms({
      docket_id: docketId,
      sms_type: smsType,
      to_last4: to ? last4Of(to) : null,
      body,
      twilio_sid: null,
      status: 'send_error',
      error_code: null,
      error_message: 'Twilio credentials missing',
    });
    return false;
  }

  if (!to || to.trim() === '') {
    await logSms({
      docket_id: docketId,
      sms_type: smsType,
      to_last4: null,
      body,
      twilio_sid: null,
      status: 'send_error',
      error_code: null,
      error_message: 'No phone number for recipient',
    });
    console.log('[SMS] Skipping — no phone number for recipient');
    return false;
  }

  const normalized = normalizePhoneToE164(to);
  if (!normalized) {
    await logSms({
      docket_id: docketId,
      sms_type: smsType,
      to_last4: last4Of(to),
      body,
      twilio_sid: null,
      status: 'send_error',
      error_code: null,
      error_message: `Cannot normalize phone number ending ${to.slice(-4)}`,
    });
    console.warn(`[SMS] Cannot normalize phone number: ${to.slice(-4)}`);
    return false;
  }

  try {
    const from = process.env.TWILIO_PHONE_NUMBER!;
    const statusCallback = `${getAppBaseUrl()}/api/webhooks/twilio/sms-status`;
    const message = await client.messages.create({ body, from, to: normalized, statusCallback });
    await logSms({
      docket_id: docketId,
      sms_type: smsType,
      to_last4: normalized.slice(-4),
      body,
      twilio_sid: message.sid,
      status: message.status ?? 'sent',
      error_code: null,
      error_message: null,
    });
    console.log(`[SMS] Sent to ${normalized.slice(-4)} (sid ${message.sid}, ${message.status})`);
    return true;
  } catch (err: unknown) {
    const errorCode =
      typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    await logSms({
      docket_id: docketId,
      sms_type: smsType,
      to_last4: normalized.slice(-4),
      body,
      twilio_sid: null,
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
    });

    if (errorCode === '21608') {
      console.warn(`[SMS] Unverified number ${normalized.slice(-4)} — add it in Twilio console`);
    } else {
      console.error(`[SMS] Failed to ${normalized.slice(-4)}:`, errorMessage);
    }
    return false;
  }
}

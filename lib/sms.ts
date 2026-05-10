// Twilio SMS notification utilities for JDM Rush Docket

import Twilio from 'twilio';

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

const twilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn('[SMS] Twilio credentials missing — SMS disabled');
    return null;
  }
  return Twilio(sid, token);
};

/** Send a single SMS. Returns true on success, false on failure. Never throws. */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = twilioClient();
  if (!client) return false;

  if (!to || to.trim() === '') {
    console.log('[SMS] Skipping — no phone number for recipient');
    return false;
  }

  // Normalize to E.164 format for Twilio
  const normalized = normalizePhoneToE164(to);
  if (!normalized) {
    console.warn(`[SMS] Cannot normalize phone number: ${to.slice(-4)}`);
    return false;
  }

  try {
    const from = process.env.TWILIO_PHONE_NUMBER!;
    await client.messages.create({ body, from, to: normalized });
    console.log(`[SMS] Sent to ${normalized.slice(-4)}`);
    return true;
  } catch (err: unknown) {
    const errorCode = typeof err === 'object' && err !== null && 'code' in err ? err.code : null;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (errorCode === 21608) {
      console.warn(`[SMS] Unverified number ${normalized.slice(-4)} — add it in Twilio console`);
    } else {
      console.error(`[SMS] Failed to ${normalized.slice(-4)}:`, errorMessage);
    }
    return false;
  }
}

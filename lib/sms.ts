// Twilio SMS notification utilities for JDM Rush Docket

import Twilio from 'twilio';

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

  try {
    const from = process.env.TWILIO_PHONE_NUMBER!;
    await client.messages.create({ body, from, to });
    console.log(`[SMS] Sent to ${to.slice(-4)}`);
    return true;
  } catch (err: any) {
    if (err.code === 21608) {
      console.warn(`[SMS] Unverified number ${to.slice(-4)} — add it in Twilio console`);
    } else {
      console.error(`[SMS] Failed to ${to.slice(-4)}:`, err.message);
    }
    return false;
  }
}

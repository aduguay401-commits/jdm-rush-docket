/**
 * Rush email-lead seam — hands each new web-form lead to the Rush relay
 * (rush-relay `POST /webhook/docket-lead`), which emails the customer as
 * Rush and keeps the conversation going. See rush-relay relay/emailchan.py.
 *
 * Never fails an intake: every error is logged and swallowed, with a 5 s
 * timeout. Called BEFORE the customer confirmation so the confirmation can
 * say whether Rush is about to email them (see rushWillEmail). Signed with HMAC-SHA256 over the raw
 * body (header `X-Rush-Signature: sha256=<hex>`); `sent_at` lets the relay
 * refuse replays. Off unless BOTH env vars are set, and always off in
 * DEV_MODE (dev intakes would email real addresses from Rush).
 */
import { createHmac } from 'node:crypto'

export type RushLead = {
  docket_id: string
  email: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  vehicle_year?: string | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  vehicle_description?: string | null
  budget?: string | null
  destination_city?: string | null
  destination_province?: string | null
  timeline?: string | null
  additional_notes?: string | null
  additional_info?: Record<string, unknown> | null
  lead_source: string
}

export function signRushBody(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

export function buildRushLeadBody(lead: RushLead, now: number = Date.now()): string {
  return JSON.stringify({ sent_at: Math.floor(now / 1000), lead })
}

/**
 * `status` is the relay's verdict when it answered: "accepted" means Rush
 * will email this customer; anything else ("outside market", "repeat",
 * "ignored: address opted out", "duplicate", …) means he won't. Callers use
 * `rushWillEmail` to decide what the confirmation email promises.
 */
export type RushPostResult = {
  result: 'sent' | 'skipped' | 'failed'
  status?: string
}

export function rushWillEmail(r: RushPostResult): boolean {
  return r.result === 'sent' && r.status === 'accepted'
}

export async function postLeadToRush(
  lead: RushLead,
  opts: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<RushPostResult> {
  const env = opts.env ?? process.env
  const url = env.RUSH_LEAD_URL
  const secret = env.RUSH_LEAD_SECRET
  if (!url || !secret || env.DEV_MODE === 'true' || !lead.email) return { result: 'skipped' }
  const body = buildRushLeadBody(lead)
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rush-Signature': signRushBody(secret, body),
      },
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn('[Rush lead] relay answered', res.status, { docketId: lead.docket_id })
      return { result: 'failed' }
    }
    const json = (await res.json().catch(() => ({}))) as { status?: unknown }
    return { result: 'sent', status: typeof json.status === 'string' ? json.status : undefined }
  } catch (error) {
    console.warn('[Rush lead] post failed', { docketId: lead.docket_id, error: String(error) })
    return { result: 'failed' }
  }
}

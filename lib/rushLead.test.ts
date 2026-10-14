import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { buildRushLeadBody, postLeadToRush, rushWillEmail, signRushBody, type RushLead } from './rushLead'

const lead: RushLead = {
  docket_id: 'd-1',
  email: 'jane@example.com',
  first_name: 'Jane',
  vehicle_make: 'Subaru',
  lead_source: 'find_my_jdm',
}
const env = { RUSH_LEAD_URL: 'https://rush.example/webhook/docket-lead', RUSH_LEAD_SECRET: 's3cret' } as unknown as NodeJS.ProcessEnv

describe('postLeadToRush', () => {
  it('signs the exact body it sends', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, status: 'accepted' }))
    const r = await postLeadToRush(lead, { fetchImpl, env })
    expect(r).toEqual({ result: 'sent', status: 'accepted' })
    expect(rushWillEmail(r)).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(env.RUSH_LEAD_URL)
    const body = init.body as string
    const sig = (init.headers as Record<string, string>)['X-Rush-Signature']
    expect(sig).toBe('sha256=' + createHmac('sha256', 's3cret').update(body).digest('hex'))
    expect(JSON.parse(body).lead.docket_id).toBe('d-1')
    expect(typeof JSON.parse(body).sent_at).toBe('number')
  })

  it('is off without config, in DEV_MODE, or without an email', async () => {
    const fetchImpl = vi.fn()
    expect(await postLeadToRush(lead, { fetchImpl, env: {} as unknown as NodeJS.ProcessEnv })).toEqual({ result: 'skipped' })
    expect(await postLeadToRush(lead, { fetchImpl, env: { ...env, DEV_MODE: 'true' } as unknown as NodeJS.ProcessEnv })).toEqual({ result: 'skipped' })
    expect(await postLeadToRush({ ...lead, email: null }, { fetchImpl, env })).toEqual({ result: 'skipped' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never throws when the relay is down or refuses', async () => {
    const down = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    expect(await postLeadToRush(lead, { fetchImpl: down as unknown as typeof fetch, env })).toEqual({ result: 'failed' })
    const refuses = vi.fn(async () => new Response('no', { status: 503 }))
    expect(await postLeadToRush(lead, { fetchImpl: refuses, env })).toEqual({ result: 'failed' })
  })

  it('only an accepted lead means Rush will email', async () => {
    const outside = vi.fn(async () => Response.json({ ok: true, status: 'outside market' }))
    expect(rushWillEmail(await postLeadToRush(lead, { fetchImpl: outside, env }))).toBe(false)
    expect(rushWillEmail({ result: 'skipped' })).toBe(false)
    expect(rushWillEmail({ result: 'failed' })).toBe(false)
  })

  it('body helpers are stable', () => {
    expect(buildRushLeadBody(lead, 1_700_000_000_000)).toBe(JSON.stringify({ sent_at: 1_700_000_000, lead }))
    expect(signRushBody('k', 'x')).toMatch(/^sha256=[0-9a-f]{64}$/)
  })
})

describe('Adam WhatsApp line (confirmation when Rush is emailing)', () => {
  it('points at Adam personal number, not the Rush line', async () => {
    const { ADAM_WHATSAPP_URL, RUSH_WHATSAPP_URL, renderAdamWhatsAppLineHtml, renderAdamWhatsAppLineText } = await import('./rush')
    expect(ADAM_WHATSAPP_URL).toBe('https://wa.me/12042304683')
    expect(ADAM_WHATSAPP_URL).not.toBe(RUSH_WHATSAPP_URL)
    expect(renderAdamWhatsAppLineHtml()).toContain(`href="${ADAM_WHATSAPP_URL}"`)
    expect(renderAdamWhatsAppLineText()).toContain('+1 204-230-4683')
  })
})

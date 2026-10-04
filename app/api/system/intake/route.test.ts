import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  sendEmail: vi.fn(),
  sendWhatsAppNotification: vi.fn(),
  fetchJPYtoCAD: vi.fn(),
  isIpRateLimited: vi.fn(),
  countRecentDocketsForEmail: vi.fn(),
  appendNoteToNewestDocketForEmail: vi.fn(),
  isUnderWelcomeEmailCap: vi.fn(),
  insertDocket: vi.fn(),
  insertEmailLog: vi.fn(),
}));

// Keep the actual honeypot, timing, and authenticated-IP logic. Replace every
// database/network/email boundary; these tests must never contact live intake.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsAppNotification: mocks.sendWhatsAppNotification }));
vi.mock('@/lib/exchangeRate', () => ({ fetchJPYtoCAD: mocks.fetchJPYtoCAD }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/lib/sms', () => ({ normalizePhoneToE164: vi.fn(() => null) }));
vi.mock('@/lib/urls', () => ({
  getAppBaseUrl: () => 'https://example.invalid',
  getCustomerHomeBaseUrl: () => 'https://example.invalid/customer',
}));
vi.mock('@/lib/customer/AccountUpsell', () => ({
  buildAccountRegisterUrl: () => 'https://example.invalid/register',
  renderAccountUpsellEmailFooter: () => '',
  renderAccountUpsellEmailTextFooter: () => '',
}));
vi.mock('@/lib/intake/guardrails', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/intake/guardrails')>(),
  isIpRateLimited: mocks.isIpRateLimited,
  countRecentDocketsForEmail: mocks.countRecentDocketsForEmail,
  appendNoteToNewestDocketForEmail: mocks.appendNoteToNewestDocketForEmail,
  isUnderWelcomeEmailCap: mocks.isUnderWelcomeEmailCap,
}));

import { POST } from './route';

const docketId = '11111111-2222-4333-8444-555555555555';
function intakeRequest(payload: Record<string, unknown> = {}, authenticated = true) {
  return new Request('https://example.invalid/api/system/intake', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? {
        'x-intake-proxy-secret': 'test-only-secret',
        'x-intake-client-ip': '203.0.113.9',
      } : {}),
    },
    body: JSON.stringify({
      customer_email: 'qa@example.invalid',
      vehicle_description: 'Honda Acty',
      form_rendered_at: String(Date.now() - 10000),
      ...payload,
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('INTAKE_PROXY_SECRET', 'test-only-secret');
  vi.stubEnv('FROM_EMAIL', 'sender@example.invalid');
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.invalid');
  vi.stubEnv('MARCUS_EMAIL', 'agent@example.invalid');
  vi.stubEnv('MARCUS_CC_EMAIL', '');
  vi.stubEnv('DEV_MODE', 'false');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in isolated intake test'); }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.fetchJPYtoCAD.mockResolvedValue({ rate: 0.009, date: '2026-10-04' });
  mocks.isIpRateLimited.mockResolvedValue(false);
  mocks.countRecentDocketsForEmail.mockResolvedValue(0);
  mocks.appendNoteToNewestDocketForEmail.mockResolvedValue(docketId);
  mocks.isUnderWelcomeEmailCap.mockResolvedValue(true);
  mocks.sendEmail.mockResolvedValue({ error: null });
  mocks.sendWhatsAppNotification.mockResolvedValue(undefined);
  mocks.insertEmailLog.mockResolvedValue({ error: null });
  mocks.insertDocket.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: docketId, questions_url_token: 'test-token' }, error: null }) }),
  });
  mocks.createServerClient.mockReturnValue({
    from: (table: string) => {
      if (table === 'dockets') return {
        select: () => ({ limit: async () => ({ error: null }) }),
        insert: mocks.insertDocket,
      };
      if (table === 'email_log') return { insert: mocks.insertEmailLog };
      throw new Error(`Unexpected database table: ${table}`);
    },
  });
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('intake POST saved-lead receipt integration', () => {
  it.each(['honeypot', 'too_fast'])('never emits a receipt for a real %s discard', async (kind) => {
    const response = await POST(intakeRequest(kind === 'honeypot'
      ? { company_website: 'https://bot.invalid' }
      : { form_rendered_at: String(Date.now()) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, docketId: expect.any(String) });
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('emits a receipt after a normal saved intake with mocked notifications', async () => {
    const response = await POST(intakeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, docketId });
    expect(response.headers.get('x-jdm-saved-docket-id')).toBe(docketId);
    expect(mocks.insertDocket).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ customer_email: 'qa@example.invalid' }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(3);
    expect(mocks.insertEmailLog).toHaveBeenCalledTimes(3);
    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledTimes(1);
  });

  it('keeps the public response unchanged for an unauthenticated saved intake', async () => {
    const response = await POST(intakeRequest({}, false));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, docketId });
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
  });

  it('emits the existing docket receipt when a capped submission saves a note', async () => {
    mocks.countRecentDocketsForEmail.mockResolvedValue(4);
    const response = await POST(intakeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, docketId });
    expect(response.headers.get('x-jdm-saved-docket-id')).toBe(docketId);
    expect(mocks.appendNoteToNewestDocketForEmail).toHaveBeenCalledWith(expect.anything(), 'qa@example.invalid', expect.stringContaining('Honda Acty'));
    expect(mocks.insertDocket).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('does not emit a receipt if a capped submission has no saved docket', async () => {
    mocks.countRecentDocketsForEmail.mockResolvedValue(4);
    mocks.appendNoteToNewestDocketForEmail.mockResolvedValue(null);
    const response = await POST(intakeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, docketId: null });
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
  });

  it('does not emit a receipt for a failed database insert', async () => {
    mocks.insertDocket.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: { message: 'Test database failure' } }) }) });
    const response = await POST(intakeRequest());
    expect(response.status).toBe(500);
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('preserves failure behaviour without a receipt if notification fails after save', async () => {
    mocks.sendEmail.mockResolvedValue({ error: 'Test delivery failure' });
    const response = await POST(intakeRequest());
    expect(response.status).toBe(500);
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    expect(mocks.insertDocket).toHaveBeenCalledOnce();
  });

  it('does not emit a receipt for a rate-limited request', async () => {
    mocks.isIpRateLimited.mockResolvedValue(true);
    const response = await POST(intakeRequest());
    expect(response.status).toBe(429);
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    expect(mocks.insertDocket).not.toHaveBeenCalled();
  });
});

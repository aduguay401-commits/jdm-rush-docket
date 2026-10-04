import { afterEach, describe, expect, it, vi } from 'vitest';
import { savedLeadResponse } from './saved-lead-response';

const docketId = '11111111-2222-4333-8444-555555555555';
const request = (secret?: string, ip?: string) => new Request('https://example.test/api/system/intake', {
  headers: {
    ...(secret ? { 'x-intake-proxy-secret': secret } : {}),
    ...(ip ? { 'x-intake-client-ip': ip } : {}),
  },
});

afterEach(() => vi.unstubAllEnvs());

describe('saved lead receipt', () => {
  it('returns the saved ID only to an authenticated proxy', async () => {
    vi.stubEnv('INTAKE_PROXY_SECRET', 'test-only-secret');
    const response = savedLeadResponse(request('test-only-secret', '203.0.113.9'), docketId);
    expect(response.headers.get('x-jdm-saved-docket-id')).toBe(docketId);
    await expect(response.json()).resolves.toEqual({ success: true, docketId });
  });

  it.each([
    [undefined, '203.0.113.9'],
    ['wrong-secret', '203.0.113.9'],
    ['test-only-secret', undefined],
  ])('preserves the public shape without trusted authentication (%s, %s)', async (secret, ip) => {
    vi.stubEnv('INTAKE_PROXY_SECRET', 'test-only-secret');
    const response = savedLeadResponse(request(secret, ip), docketId);
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    await expect(response.json()).resolves.toEqual({ success: true, docketId });
  });

  it('never enables receipts when the configured secret is missing', () => {
    vi.stubEnv('INTAKE_PROXY_SECRET', '');
    expect(savedLeadResponse(request('claimed-secret', '203.0.113.9'), docketId)
      .headers.has('x-jdm-saved-docket-id')).toBe(false);
  });

  it('does not confirm a cap response with no saved docket', async () => {
    vi.stubEnv('INTAKE_PROXY_SECRET', 'test-only-secret');
    const response = savedLeadResponse(request('test-only-secret', '203.0.113.9'), null);
    expect(response.headers.has('x-jdm-saved-docket-id')).toBe(false);
    await expect(response.json()).resolves.toEqual({ success: true, docketId: null });
  });
});

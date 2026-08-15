import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RUSH_WHATSAPP_NUMBER,
  RUSH_WHATSAPP_URL,
  renderRushWhatsAppLineHtml,
  renderRushWhatsAppLineText,
} from './rush';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Rush WhatsApp URL', () => {
  it('builds the correct wa.me URL from the digits-only number', () => {
    expect(RUSH_WHATSAPP_NUMBER).toBe('12048139003');
    expect(RUSH_WHATSAPP_URL).toBe('https://wa.me/12048139003');
  });
});

describe('renderRushWhatsAppLineHtml', () => {
  it('renders the spec copy with a proper clickable anchor', () => {
    const html = renderRushWhatsAppLineHtml();
    expect(html).toContain('Questions? Chat with Rush on WhatsApp: ');
    // The href is the full https URL; the anchor text is the spec's wa.me form.
    expect(html).toContain(`<a href="${RUSH_WHATSAPP_URL}"`);
    expect(html).toContain('wa.me/12048139003');
    expect(html).toContain('</a>');
    // Orange link, matching the emails' existing link colour.
    expect(html).toContain('color: #E55125');
  });
});

describe('renderRushWhatsAppLineText', () => {
  it('renders the plain-text line with the full clickable URL', () => {
    expect(renderRushWhatsAppLineText()).toBe(
      `Questions? Chat with Rush on WhatsApp: ${RUSH_WHATSAPP_URL}`
    );
  });
});

describe('scope guard — the line lives in quote + intake only', () => {
  const inScope = [
    'app/api/system/quote/route.ts',
    'app/api/system/intake/route.ts',
  ];
  // The other customer-facing (and admin) email surfaces, scouted at ticket #8.
  // The line must NOT appear in any of them — scope discipline, not just code.
  const outOfScope = [
    'lib/emails/signedAgreement.ts',
    'lib/emails/weeklyMatches.ts',
    'lib/emails/reportReadyAdmin.ts',
    'app/api/agent/send-agreement/route.ts',
    'app/api/agent/send-questions/route.ts',
    'app/api/agent/proceed/route.ts',
    'app/api/agent/research/[id]/route.ts',
    'app/api/customer/approve/[token]/route.ts',
    'app/api/customer/docket/[id]/sign/route.ts',
    'app/api/customer/questions/[token]/route.ts',
    'app/api/customer/questions/[token]/ask/route.ts',
    'app/api/customer/report/[token]/question/route.ts',
    'app/api/cron/nurture-matches/route.ts',
    'app/api/cron/follow-up/route.ts',
    'app/api/admin/remind/[id]/route.ts',
    'lib/invoiceStub.ts',
  ];

  it('each in-scope route integrates BOTH the HTML and text renderers individually', () => {
    for (const rel of inScope) {
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
      // Pin the actual CALL sites (not just the import): if either variant is
      // removed from a route, that route's assertion fails.
      expect(src, `${rel} must call renderRushWhatsAppLineHtml()`).toContain(
        'renderRushWhatsAppLineHtml()'
      );
      expect(src, `${rel} must call renderRushWhatsAppLineText()`).toContain(
        'renderRushWhatsAppLineText()'
      );
    }
  });

  it('no out-of-scope email references the WhatsApp number or wa.me', () => {
    for (const rel of outOfScope) {
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
      expect(src, `${rel} must not reference the number`).not.toContain(
        '12048139003'
      );
      expect(src, `${rel} must not reference wa.me`).not.toContain('wa.me');
    }
  });
});

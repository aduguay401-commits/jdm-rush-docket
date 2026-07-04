import "server-only";

import { CASL_SENDER_IDENTITY } from "@/lib/nurture/consent";
import type { NurtureMatchCandidate } from "@/lib/nurture/matching";
import { getNurtureUnsubscribeUrl } from "@/lib/urls";

const LOGO_URL =
  "https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png";
const DEFAULT_BROWSE_URL = "https://www.jdmrushimports.ca/browse-japan-stock";
const SUPPORT_EMAIL = "support@jdmrushimports.ca";

export type WeeklyMatchEmailCar = Pick<
  NurtureMatchCandidate,
  "ref" | "url" | "year" | "make" | "model" | "card_estimate_cad"
> & {
  imageUrl: string | null;
};

export type WeeklyMatchesEmail = {
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
};

export type RenderWeeklyMatchesEmailInput = {
  anchorVehicleLabel: string;
  matches: WeeklyMatchEmailCar[];
  unsubscribeToken: string;
  devMode?: boolean;
  originalRecipient?: string | null;
  browseUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCadAmount(value: number): string {
  return `$${Math.round(value).toLocaleString("en-CA")} CAD`;
}

function vehicleLabel(match: WeeklyMatchEmailCar): string {
  return [match.year, match.make, match.model]
    .filter((value) => String(value).trim().length > 0)
    .join(" ");
}

function renderCardHtml(match: WeeklyMatchEmailCar): string {
  const label = vehicleLabel(match);
  const safeLabel = escapeHtml(label);
  const safeListingUrl = escapeHtml(match.url);
  const safePrice = escapeHtml(formatCadAmount(match.card_estimate_cad));
  const imageHtml = match.imageUrl
    ? `<tr>
    <td style="padding:0;">
      <img src="${escapeHtml(match.imageUrl)}" width="536" alt="${safeLabel}" style="display:block;width:100%;max-width:536px;height:auto;border:0;" />
    </td>
  </tr>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:536px;margin:0 auto 20px auto;background-color:#1a1a1a;border-collapse:collapse;">
  ${imageHtml}
  <tr>
    <td style="padding:20px 24px 12px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#ffffff;line-height:1.35;">
            ${safeLabel}
          </td>
          <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#E55125;white-space:nowrap;line-height:1.35;">
            ${safePrice}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:4px 24px 20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" bgcolor="#E55125" style="background-color:#E55125;padding:14px 20px;">
            <a href="${safeListingUrl}" target="_blank" style="display:block;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;line-height:1.3;">
              View Listing &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function renderWeeklyMatchesEmail({
  anchorVehicleLabel,
  matches,
  unsubscribeToken,
  devMode = false,
  originalRecipient = null,
  browseUrl = DEFAULT_BROWSE_URL,
}: RenderWeeklyMatchesEmailInput): WeeklyMatchesEmail {
  const selectedMatches = matches.slice(0, 3);
  if (selectedMatches.length !== 3) {
    throw new Error("Weekly matches email requires exactly 3 matches");
  }

  const unsubscribeUrl = getNurtureUnsubscribeUrl(unsubscribeToken);
  const safeAnchorVehicleLabel = escapeHtml(anchorVehicleLabel);
  const subject = `3 Japan Stock matches like your ${anchorVehicleLabel}`;
  const safeBrowseUrl = escapeHtml(browseUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const cardHtml = selectedMatches.map(renderCardHtml).join("\n");
  const devBannerHtml =
    devMode && originalRecipient
      ? `<tr><td style="padding:0 0 20px 0;"><div style="background:#2a130a;border:1px solid #E55125;padding:12px;color:#f8d1c5;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">[DEV MODE] This email would normally go to ${escapeHtml(originalRecipient)}</div></td></tr>`
      : "";
  const devTextBanner =
    devMode && originalRecipient
      ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n`
      : "";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d0d0d;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#0d0d0d;padding:40px 32px;border-collapse:collapse;">
            ${devBannerHtml}
            <tr>
              <td style="padding:0 0 32px 0;">
                <img src="${LOGO_URL}" alt="JDM Rush Imports" height="50" style="height:50px;width:auto;display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;line-height:1.3;color:#ffffff;margin:0 0 12px 0;">3 Japan Stock matches for you this week</h1>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#cccccc;margin:0 0 26px 0;">Cars like the <strong style="color:#ffffff;">${safeAnchorVehicleLabel}</strong> you priced.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                ${cardHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0 0 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#151515;border:1px solid #2a2a2a;border-collapse:collapse;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#ffffff;font-weight:700;margin:0 0 10px 0;">Reply to this email and we'll help you track down the right one.</p>
                      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#cccccc;margin:0 0 16px 0;">Tell us what you like, what you would change, or where your budget landed after seeing these.</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px 0;">
                        <tr>
                          <td align="center" bgcolor="#E55125" style="background-color:#E55125;padding:15px 20px;">
                            <a href="mailto:${SUPPORT_EMAIL}" style="display:block;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;line-height:1.3;">Reply to contact us</a>
                          </td>
                        </tr>
                      </table>
                      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#aaaaaa;margin:0;"><a href="${safeBrowseUrl}" target="_blank" style="color:#E55125;text-decoration:none;">Browse all Japan Stock &rarr;</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                <hr style="border:0;border-top:1px solid #2a2a2a;margin:30px 0;" />
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#888888;margin:0 0 8px 0;">You're receiving this because you asked for weekly Japan Stock matches after getting a quote from us.</p>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#888888;margin:0 0 8px 0;">${escapeHtml(CASL_SENDER_IDENTITY)}</p>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#888888;margin:0;"><a href="${safeUnsubscribeUrl}" target="_blank" style="color:#E55125;text-decoration:none;">Unsubscribe from weekly matches</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textMatches = selectedMatches
    .map(
      (match, index) =>
        `${index + 1}. ${vehicleLabel(match)} - ${formatCadAmount(match.card_estimate_cad)}\nView listing: ${match.url}`,
    )
    .join("\n\n");

  const text = `${devTextBanner}3 Japan Stock matches for you this week

Cars like the ${anchorVehicleLabel} you priced.

${textMatches}

Reply to this email and we'll help you track down the right one.
Browse all Japan Stock: ${browseUrl}

You're receiving this because you asked for weekly Japan Stock matches after getting a quote from us.
${CASL_SENDER_IDENTITY}
Unsubscribe from weekly matches: ${unsubscribeUrl}`;

  return { subject, html, text, unsubscribeUrl };
}

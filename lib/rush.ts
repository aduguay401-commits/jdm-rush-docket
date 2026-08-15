/**
 * Rush WhatsApp seam — the customer-facing Rush handoff number and the
 * "chat on WhatsApp" line added to Docket's outbound emails (ticket #8).
 *
 * Mirrors the jdm-rush-next repo's src/lib/rush.ts discipline: the number
 * lives in exactly one place, and the line copy lives in exactly one place,
 * so the line renders identically across every email and every variant.
 */

/** Rush's WhatsApp number (digits only) — same number as the jdm-rush-next Rush panel. */
export const RUSH_WHATSAPP_NUMBER = '12048139003';

/** The wa.me click-to-chat URL — no target vehicle, so it is a plain constant. */
export const RUSH_WHATSAPP_URL = `https://wa.me/${RUSH_WHATSAPP_NUMBER}`;

/**
 * The customer-facing line, HTML variant. Renders "wa.me/…" as the anchor
 * text (the spec copy) with the full https URL as the href, in the emails'
 * existing orange link colour. Returns the INNER content only — the caller
 * owns the wrapping paragraph so each email keeps its own spacing.
 */
export function renderRushWhatsAppLineHtml(): string {
  return `Questions? Chat with Rush on WhatsApp: <a href="${RUSH_WHATSAPP_URL}" style="color: #E55125; font-weight: 700; text-decoration: none;">wa.me/${RUSH_WHATSAPP_NUMBER}</a>`;
}

/**
 * The customer-facing line, plain-text variant — carries the full https URL
 * so plain-text clients still render a clickable link.
 */
export function renderRushWhatsAppLineText(): string {
  return `Questions? Chat with Rush on WhatsApp: ${RUSH_WHATSAPP_URL}`;
}

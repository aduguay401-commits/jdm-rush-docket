// ── Loop 2.1-i: POST /api/system/quote ──────────────────────────────────
//
// Public endpoint the jdm-rush-next site calls when a customer submits
// "Get my exact quote" for a specific inventory car.  Computes the exact
// landed CAD cost to their city and emails the result.
//
// REUSES (does not duplicate):
//   - calculateImportCost + normalizeDestinationCity (lib/importCalculator)
//   - classifyVehicleType + SUV_MODELS               (lib/importCalculator)
//   - fetchJPYtoCAD                                  (lib/exchangeRate)
//   - sendEmail                                      (lib/email)
//   - Supabase docket insert + email_log insert      (mirrors intake)

import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  buildAccountRegisterUrl,
  renderAccountUpsellEmailPanel,
  renderAccountUpsellEmailTextFooter,
} from "@/lib/customer/AccountUpsell";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import {
  calculateImportCost,
  normalizeDestinationCity,
  classifyVehicleType,
  calculateCardEstimate,
} from "@/lib/importCalculator";
import type { DutyType } from "@/lib/importCalculator";
import { buildAnchorModelKey, CASL_SENDER_IDENTITY } from "@/lib/nurture/consent";
import { createServerClient } from "@/lib/supabase/server";
import { getNurtureOptInUrl } from "@/lib/urls";

function isNurtureOptInEnabled(): boolean {
  return process.env.NURTURE_OPTIN_ENABLED === "true";
}

// ── Request shape ───────────────────────────────────────────────────────

interface QuotePayload {
  ref?: string;
  year?: number | string;
  make?: string;
  model?: string;
  vehiclePriceJPY?: number | string;
  dutyType?: string;
  destinationCity?: string;
  email?: string;
  name?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Basic email format validation.  Does not try to be exhaustive — just
 * catches obviously malformed input.  Full anti-spam (captcha / rate-limit
 * middleware) is a project-wide gap shared with /api/system/intake.
 *
 * TODO(project-wide): add CAPTCHA + per-IP rate limiting to all public
 * form endpoints (quote, intake, find-my-jdm).
 */
function looksLikeValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Split a single "name" field into first + last for the CRM. */
function splitName(raw: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!raw) return { firstName: null, lastName: null };
  const trimmed = raw.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed, lastName: null };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim() || null,
  };
}

/** Penny-plug: displayed rows must sum exactly to totalDeliveredCAD.
 *  Compute "Import fees & services" as total minus the other visible rows
 *  so the email never shows a 1¢ round-vs-sum discrepancy. */
function importFeesLine(b: ReturnType<typeof calculateImportCost>): number {
  const visible = b.vehicleValueCAD + b.shippingInsuranceCAD + b.dutyCAD + b.gstCAD + b.wwsTerminalFeeCAD + b.transportCostCAD;
  return Math.round((b.totalDeliveredCAD - visible) * 100) / 100;
}

// ── POST handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: QuotePayload = await request.json();

    // 1. Validate required fields
    const email = toOptionalString(body.email);
    if (!email || !looksLikeValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email address is required" },
        { status: 400 },
      );
    }

    const ref = toOptionalString(body.ref);
    const make = toOptionalString(body.make);
    const model = toOptionalString(body.model);

    const vehiclePriceJPY = toNumber(body.vehiclePriceJPY);
    if (
      vehiclePriceJPY == null ||
      vehiclePriceJPY <= 0 ||
      vehiclePriceJPY > 100_000_000
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "vehiclePriceJPY is required and must be between 1 and 100,000,000",
        },
        { status: 400 },
      );
    }

    const dutyType: DutyType =
      body.dutyType === "duty-free" ? "duty-free" : "full-duty";

    const rawDestination = toOptionalString(body.destinationCity);
    if (!rawDestination) {
      return NextResponse.json(
        { ok: false, error: "destinationCity is required" },
        { status: 400 },
      );
    }

    // 2. Normalize destination
    const destinationCity = normalizeDestinationCity(rawDestination);
    if (!destinationCity) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unrecognized destination: "${rawDestination}". Please pick a listed city.`,
        },
        { status: 400 },
      );
    }

    // 3. Classify vehicle type (contains/startsWith matching for variants)
    const vehicleType = classifyVehicleType(model);

    // 4. Live exchange rate
    const exchange = await fetchJPYtoCAD();

    // 5. EXACT landed cost
    const breakdown = calculateImportCost({
      vehiclePriceJPY,
      destinationCity,
      vehicleType,
      dutyType,
      exchangeRate: exchange.rate,
    });

    // ── 6. DEV_MODE: send email to admin, not real customer ──────────
    const devMode = process.env.DEV_MODE === "true";
    const fromEmail = process.env.FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const customerOriginalEmail = email;
    const customerRecipientEmail = devMode ? adminEmail : email;

    if (!fromEmail) {
      return NextResponse.json(
        { ok: false, error: "Email configuration missing" },
        { status: 500 },
      );
    }

    if (devMode && !adminEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "DEV_MODE is on but ADMIN_EMAIL is not set — cannot send test email",
        },
        { status: 500 },
      );
    }

    // ── 7. Dedupe: check for existing docket (idempotent retries) ──
    const supabase = createServerClient();

    if (ref && email) {
      // Reuse a docket created in the last 10 minutes for same email+ref
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("dockets")
        .select("id, questions_url_token")
        .eq("customer_email", email)
        .eq("vehicle_description", ref)
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.questions_url_token) {
        return NextResponse.json({
          ok: true,
          totalDeliveredCAD: breakdown.totalDeliveredCAD,
          reportToken: existing.questions_url_token,
        });
      }
    }

    // ── 8. Build email body ──────────────────────────────────────────
    const { firstName } = splitName(toOptionalString(body.name));
    const greeting = firstName ?? "there";
    const vehicleLabel = [body.year, make, model].filter(Boolean).join(" ");
    const cadFormatted = breakdown.totalDeliveredCAD.toLocaleString("en-CA");

    const devModeBannerHtml =
      devMode && customerOriginalEmail
        ? `<div style="margin: 0 0 20px; background: #2a130a; border: 1px solid #E55125; border-radius: 8px; padding: 12px; color: #f8d1c5; font-size: 13px;">[DEV MODE] This email would normally go to: ${escapeHtml(customerOriginalEmail)}</div>`
        : "";

    const devModeBannerText =
      devMode && customerOriginalEmail
        ? `[DEV MODE — This email would normally go to: ${customerOriginalEmail}]\n\n`
        : "";

    // Helper: build email HTML/text bodies.
    const makeEmailHtml = (nurtureOptInUrl: string | null, accountRegisterUrl: string) => {
      const nurtureOptInHtml = nurtureOptInUrl
        ? `<div style="background: #151515; border: 1px solid #2a2a2a; padding: 20px; margin: 24px 0;">
    <p style="font-size: 13px; color: #E55125; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 8px 0;">WANT US TO KEEP LOOKING?</p>
    <p style="color: #cccccc; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
      We can send you 3 similar Japan Stock matches about once a week based on this quote. You are not signed up unless you confirm on the next page.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse: separate; margin: 0 auto 14px auto; width: 100%;">
      <tr>
        <td align="center" bgcolor="#E55125" style="background-color: #E55125; padding: 15px 20px;">
          <a href="${escapeHtml(nurtureOptInUrl)}" target="_blank" style="display: inline-block; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; line-height: 1.3;">Send me 3 similar Japan Stock matches each week</a>
        </td>
      </tr>
    </table>
    <p style="color: #888888; font-size: 12px; line-height: 1.6; margin: 0;">By confirming, you agree to receive weekly vehicle match emails from ${escapeHtml(CASL_SENDER_IDENTITY)}. Unsubscribe anytime with one click.</p>
  </div>`
        : "";
      const accountUpsellHtml = renderAccountUpsellEmailPanel({ registerUrl: accountRegisterUrl });

      return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px 32px; border-radius: 12px;">
  ${devModeBannerHtml}
  <img src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png" alt="JDM Rush Imports" style="height: 50px; margin-bottom: 32px; display: block;" />
  <h1 style="font-size: 24px; font-weight: 700; line-height: 1.3; margin: 0 0 16px 0;">Your exact import quote, ${escapeHtml(greeting)}</h1>
  <p style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
    Here is the landed cost for the <strong style="color: #ffffff;">${escapeHtml(vehicleLabel)}</strong> delivered to <strong style="color: #ffffff;">${escapeHtml(breakdown.destinationLabel)}</strong>.
  </p>

  <!-- Total -->
  <div style="background: #1a1a1a; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
    <p style="font-size: 13px; color: #E55125; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 8px 0;">TOTAL LANDED COST</p>
    <p style="font-size: 42px; font-weight: 800; color: #E55125; margin: 0; line-height: 1.1;">$${escapeHtml(cadFormatted)}</p>
    <p style="font-size: 14px; color: #aaaaaa; margin: 8px 0 0 0;">CAD · delivered to ${escapeHtml(breakdown.destinationLabel)}</p>
  </div>

  <!-- Breakdown — all rows sum to the total -->
  <div style="background: #1a1a1a; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <p style="font-size: 13px; color: #ffffff; font-weight: 700; margin: 0 0 12px 0;">What's included</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Vehicle (FOB Japan)</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.vehicleValueCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Shipping &amp; insurance</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.shippingInsuranceCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Customs duty${dutyType === "duty-free" ? " (0% — Japanese make)" : " (6.1%)"}</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.dutyCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">GST (5%)</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.gstCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Import fees &amp; services</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${importFeesLine(breakdown).toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Port &amp; handling</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.wwsTerminalFeeCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Inland transport</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.transportCostCAD.toLocaleString("en-CA")}</td></tr>
      <tr style="border-top: 1px solid #333;"><td style="padding: 10px 0 6px 0; font-size: 16px; color: #ffffff; font-weight: 700;">Total landed</td><td style="padding: 10px 0 6px 0; font-size: 16px; color: #E55125; font-weight: 700; text-align: right;">$${cadFormatted}</td></tr>
    </table>
  </div>

  ${nurtureOptInHtml}

  ${accountUpsellHtml}

  <hr style="border: 0; border-top: 1px solid #2a2a2a; margin: 30px 0;" />

  <p style="color: #888888; font-size: 13px; line-height: 1.6; margin: 0 0 12px 0;">
    ⚠️ This estimate is calculated at today's exchange rate of ${exchange.rate.toFixed(4)} JPY/CAD (Bank of Canada, ${exchange.date}). Final amounts may vary slightly based on the exchange rate at time of purchase and any changes in import fees.
  </p>
  <p style="color: #888888; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
    Duty classification for Japanese makes (0%) is based on Canada's tariff schedule and is our best assessment — not a legal guarantee.
  </p>

  <p style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
    Ready to move forward? Reply to this email and we'll get the ball rolling.
  </p>
  <p style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">
    — Adam &amp; the JDM Rush Team
  </p>
  <p style="color: #888888; font-size: 14px; margin-top: 32px; line-height: 1.6;">
    <a href="mailto:support@jdmrushimports.ca" style="color: #E55125;">support@jdmrushimports.ca</a>
  </p>
</div>`;
    };

    const subject = `Your exact JDM import quote — ${vehicleLabel}`;

    // ── 9. Create docket (before email so we have the report token for CTA) ──
    const { firstName: crmFirstName, lastName: crmLastName } = splitName(
      toOptionalString(body.name),
    );

    const cadFormattedForInsert = breakdown.totalDeliveredCAD
      .toLocaleString("en-CA");

    const docketInsert = {
      status: "new" as const,
      customer_email: customerOriginalEmail,
      customer_first_name: crmFirstName,
      customer_last_name: crmLastName,
      vehicle_year: body.year != null ? String(body.year) : null,
      vehicle_make: make,
      vehicle_model: model,
      vehicle_description: ref,
      destination_city: rawDestination,
      destination_province: breakdown.province,
      vehicle_type: vehicleType,
      duty_type: dutyType,
      budget_bracket: null,
      exchange_rate_at_report: exchange.rate,
      exchange_rate_date: exchange.date,
      selected_path: "quote-endpoint",
      lead_source: "exact_quote",
      lead_source_set_at: new Date().toISOString(),
      lead_source_detail: {
        route: "/api/system/quote",
        inventory_ref: ref,
      },
      additional_notes: `Exact quote computed: $${cadFormattedForInsert} CAD landed to ${breakdown.destinationLabel}`,
    };

    const { data: docket, error: insertError } = await supabase
      .from("dockets")
      .insert(docketInsert)
      .select("id, questions_url_token")
      .single();

    if (insertError || !docket) {
      console.error("[Quote] Docket insert failed");
      return NextResponse.json(
        { ok: false, error: "Unable to create your quote. Please try again." },
        { status: 500 },
      );
    }

    const accountRegisterUrl = buildAccountRegisterUrl({
      email: customerOriginalEmail,
      nextPath: "/account",
    });
    const nurtureOptInEnabled = isNurtureOptInEnabled();
    let nurtureOptInUrl: string | null = null;

    if (nurtureOptInEnabled) {
      try {
        const { data: tokenRow, error: tokenError } = await supabase
          .from("dockets")
          .select("marketing_unsubscribe_token")
          .eq("id", docket.id);

        if (tokenError) {
          throw tokenError;
        }

        const token = tokenRow?.[0]?.marketing_unsubscribe_token;
        if (!token) {
          throw new Error("marketing_unsubscribe_token not available");
        }

        const anchorYear = toNumber(body.year);
        const anchorCardEstimateCAD = calculateCardEstimate({
          vehiclePriceJPY,
          dutyType,
          exchangeRate: exchange.rate,
        });

        const { error: savedSearchError } = await supabase.from("lead_saved_searches").insert({
          docket_id: docket.id,
          email: customerOriginalEmail,
          anchor_ref: ref,
          anchor_url: null,
          anchor_year: anchorYear,
          anchor_make: make,
          anchor_model: model,
          anchor_model_key: buildAnchorModelKey(make, model),
          anchor_price_jpy: Math.round(vehiclePriceJPY),
          anchor_card_estimate_cad: anchorCardEstimateCAD,
          anchor_duty_type: dutyType,
          destination_city: breakdown.destinationLabel,
          active: false,
        });

        if (savedSearchError) {
          throw savedSearchError;
        }

        nurtureOptInUrl = getNurtureOptInUrl(String(token));
      } catch (savedSearchSeedError) {
        console.error("[Quote] Saved search opt-in seed skipped", savedSearchSeedError);
      }
    }

    // ── 10. Send email ───────────────────────────────────────────────
    const htmlBody = makeEmailHtml(nurtureOptInUrl, accountRegisterUrl);

    const nurtureOptInText = nurtureOptInUrl
      ? `\nSend me 3 similar Japan Stock matches each week: ${nurtureOptInUrl}\nConfirming signs you up for weekly vehicle match emails from ${CASL_SENDER_IDENTITY}. You can unsubscribe anytime with one click.\n`
      : "";
    const accountUpsellText = renderAccountUpsellEmailTextFooter({ registerUrl: accountRegisterUrl });

    const textBody = `${devModeBannerText}Your exact import quote — ${vehicleLabel}

Here is the landed cost for the ${vehicleLabel} delivered to ${breakdown.destinationLabel}.

TOTAL LANDED COST: $${cadFormatted} CAD

What's included:
- Vehicle (FOB Japan): $${breakdown.vehicleValueCAD.toLocaleString("en-CA")}
- Shipping & insurance: $${breakdown.shippingInsuranceCAD.toLocaleString("en-CA")}
- Customs duty: $${breakdown.dutyCAD.toLocaleString("en-CA")}${dutyType === "duty-free" ? " (0% — Japanese make)" : " (6.1%)"}
- GST (5%): $${breakdown.gstCAD.toLocaleString("en-CA")}
- Import fees & services: $${importFeesLine(breakdown).toLocaleString("en-CA")}
- Port & handling: $${breakdown.wwsTerminalFeeCAD.toLocaleString("en-CA")}
- Inland transport: $${breakdown.transportCostCAD.toLocaleString("en-CA")}

⚠️ This estimate is calculated at today's exchange rate of ${exchange.rate.toFixed(4)} JPY/CAD (Bank of Canada, ${exchange.date}). Final amounts may vary slightly based on the exchange rate at time of purchase and any changes in import fees. Duty classification for Japanese makes (0%) is based on Canada's tariff schedule and is our best assessment — not a legal guarantee.
${nurtureOptInText}
${accountUpsellText}

Ready to move forward? Reply to this email and we'll get the ball rolling.

— Adam & the JDM Rush Team
support@jdmrushimports.ca`;

    // Send email.  If it fails, mark the docket so it's not an orphan.
    try {
      await sendEmail({
        from: fromEmail,
        to: customerRecipientEmail!,
        subject,
        html: htmlBody,
        text: textBody,
      });
    } catch {
      console.error("[Quote] Email send failed");

      await supabase
        .from("dockets")
        .update({
          additional_notes: `[EMAIL FAILED] ${docketInsert.additional_notes}`,
        })
        .eq("id", docket.id);

      return NextResponse.json(
        {
          ok: false,
          error:
            "We computed your quote but could not email it. Please try again or contact us directly.",
        },
        { status: 500 },
      );
    }

    // Log the email (mirrors intake pattern)
    const { error: emailLogError } = await supabase.from("email_log").insert({
      docket_id: docket.id,
      email_type: "quote_exact_estimate",
      recipient_email: customerRecipientEmail!,
      subject,
      body_snapshot: htmlBody,
    });

    if (emailLogError) {
      console.error("[Quote] email_log insert failed");
    }

    return NextResponse.json({
      ok: true,
      totalDeliveredCAD: breakdown.totalDeliveredCAD,
      reportToken: docket.questions_url_token,
    });
  } catch {
    console.error("[Quote] Unexpected error");
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

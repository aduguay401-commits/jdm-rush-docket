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
//   - getCustomerHomeBaseUrl                         (lib/urls)

import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import {
  calculateImportCost,
  normalizeDestinationCity,
  classifyVehicleType,
} from "@/lib/importCalculator";
import type { DutyType } from "@/lib/importCalculator";
import { createServerClient } from "@/lib/supabase/server";
import { getCustomerHomeBaseUrl } from "@/lib/urls";

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

// ── POST handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: QuotePayload = await request.json();
    console.log("[Quote] Received payload:", JSON.stringify(body));

    // 1. Validate required fields
    const email = toOptionalString(body.email);
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "email is required" },
        { status: 400 },
      );
    }

    const ref = toOptionalString(body.ref);
    const make = toOptionalString(body.make);
    const model = toOptionalString(body.model);

    const vehiclePriceJPY = toNumber(body.vehiclePriceJPY);
    if (vehiclePriceJPY == null || vehiclePriceJPY <= 0) {
      return NextResponse.json(
        { ok: false, error: "vehiclePriceJPY is required and must be positive" },
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

    // 3. Classify vehicle type
    const vehicleType = classifyVehicleType(model);

    // 4. Live exchange rate
    const exchange = await fetchJPYtoCAD();

    // 5. EXACT landed cost (includes transport + PST)
    const breakdown = calculateImportCost({
      vehiclePriceJPY,
      destinationCity,
      vehicleType,
      dutyType,
      exchangeRate: exchange.rate,
    });

    // 6. Create docket / lead in Supabase
    const supabase = createServerClient();

    const docketInsert = {
      status: "new" as const,
      customer_email: email,
      customer_first_name: toOptionalString(body.name),
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
      additional_notes: `Exact quote computed: $${breakdown.totalDeliveredCAD.toLocaleString("en-CA")} CAD landed to ${breakdown.destinationLabel}`,
    };

    const { data: docket, error: insertError } = await supabase
      .from("dockets")
      .insert(docketInsert)
      .select("id, questions_url_token")
      .single();

    if (insertError || !docket) {
      console.error("[Quote] Docket insert failed:", insertError?.message);
      return NextResponse.json(
        { ok: false, error: insertError?.message ?? "Failed to create lead" },
        { status: 500 },
      );
    }

    const reportUrl = docket.questions_url_token
      ? getCustomerHomeBaseUrl(docket.questions_url_token)
      : null;

    // 7. Email the customer their exact quote
    const fromEmail = process.env.FROM_EMAIL;
    if (!fromEmail) {
      return NextResponse.json(
        { ok: false, error: "Email configuration missing" },
        { status: 500 },
      );
    }

    const name = toOptionalString(body.name) ?? "there";
    const vehicleLabel = [body.year, make, model].filter(Boolean).join(" ");
    const cadFormatted = breakdown.totalDeliveredCAD.toLocaleString("en-CA");

    const reportCtaHtml = reportUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse: separate; margin: 24px auto;">
    <tr>
      <td align="center" bgcolor="#E55125" style="background-color: #E55125; border-radius: 8px; padding: 16px 32px;">
        <a href="${escapeHtml(reportUrl)}" target="_blank" style="display: inline-block; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; line-height: 1.2;">
          📋 View Your Full Quote →
        </a>
      </td>
    </tr>
  </table>`
      : "";

    const reportCtaText = reportUrl
      ? `\nView your full quote: ${reportUrl}\n`
      : "";

    const subject = `Your exact JDM import quote — ${vehicleLabel}`;

    const htmlBody = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px 32px; border-radius: 12px;">
  <img src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png" alt="JDM Rush Imports" style="height: 50px; margin-bottom: 32px; display: block;" />
  <h1 style="font-size: 24px; font-weight: 700; line-height: 1.3; margin: 0 0 16px 0;">Your exact import quote, ${escapeHtml(name)}</h1>
  <p style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
    Here is the landed cost for the <strong style="color: #ffffff;">${escapeHtml(vehicleLabel)}</strong> delivered to <strong style="color: #ffffff;">${escapeHtml(breakdown.destinationLabel)}</strong>.
  </p>

  <!-- Total -->
  <div style="background: #1a1a1a; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
    <p style="font-size: 13px; color: #E55125; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 8px 0;">TOTAL LANDED COST</p>
    <p style="font-size: 42px; font-weight: 800; color: #E55125; margin: 0; line-height: 1.1;">$${escapeHtml(cadFormatted)}</p>
    <p style="font-size: 14px; color: #aaaaaa; margin: 8px 0 0 0;">CAD · to ${escapeHtml(breakdown.destinationLabel)}</p>
  </div>

  <!-- Quick breakdown -->
  <div style="background: #1a1a1a; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <p style="font-size: 13px; color: #ffffff; font-weight: 700; margin: 0 0 12px 0;">What's included</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Vehicle (FOB Japan)</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.vehicleValueCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Shipping &amp; insurance</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.shippingInsuranceCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Customs duty${dutyType === "duty-free" ? " (0% — Japanese make)" : " (6.1%)"}</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.dutyCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">GST (5%)</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.gstCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">PST (${(breakdown.pstRate * 100).toFixed(0)}%)</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.pstCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Port &amp; handling</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.wwsTerminalFeeCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">Inland transport</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.transportCostCAD.toLocaleString("en-CA")}</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: #cccccc;">JDM Rush service fee</td><td style="padding: 6px 0; font-size: 14px; color: #ffffff; text-align: right;">$${breakdown.jdmRushFeeCAD.toLocaleString("en-CA")}</td></tr>
      <tr style="border-top: 1px solid #333;"><td style="padding: 10px 0 6px 0; font-size: 16px; color: #ffffff; font-weight: 700;">Total landed</td><td style="padding: 10px 0 6px 0; font-size: 16px; color: #E55125; font-weight: 700; text-align: right;">$${cadFormatted}</td></tr>
    </table>
  </div>

  ${reportCtaHtml}

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

    const textBody = `Your exact import quote — ${vehicleLabel}

Here is the landed cost for the ${vehicleLabel} delivered to ${breakdown.destinationLabel}.

TOTAL LANDED COST: $${cadFormatted} CAD

Breakdown:
- Vehicle (FOB Japan): $${breakdown.vehicleValueCAD.toLocaleString("en-CA")}
- Shipping & insurance: $${breakdown.shippingInsuranceCAD.toLocaleString("en-CA")}
- Customs duty: $${breakdown.dutyCAD.toLocaleString("en-CA")}${dutyType === "duty-free" ? " (0% — Japanese make)" : " (6.1%)"}
- GST (5%): $${breakdown.gstCAD.toLocaleString("en-CA")}
- PST (${(breakdown.pstRate * 100).toFixed(0)}%): $${breakdown.pstCAD.toLocaleString("en-CA")}
- Port & handling: $${breakdown.wwsTerminalFeeCAD.toLocaleString("en-CA")}
- Inland transport: $${breakdown.transportCostCAD.toLocaleString("en-CA")}
- JDM Rush service fee: $${breakdown.jdmRushFeeCAD.toLocaleString("en-CA")}

⚠️ This estimate is calculated at today's exchange rate of ${exchange.rate.toFixed(4)} JPY/CAD (Bank of Canada, ${exchange.date}). Final amounts may vary slightly based on the exchange rate at time of purchase and any changes in import fees. Duty classification for Japanese makes (0%) is based on Canada's tariff schedule and is our best assessment — not a legal guarantee.
${reportCtaText}
Ready to move forward? Reply to this email and we'll get the ball rolling.

— Adam & the JDM Rush Team
support@jdmrushimports.ca`;

    try {
      const sendResult = await sendEmail({
        from: fromEmail,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (sendResult.error) {
        console.error("[Quote] Email send failed:", {
          docketId: docket.id,
          recipient: email,
          error: sendResult.error,
        });
        return NextResponse.json(
          { ok: false, error: "Failed to send email" },
          { status: 500 },
        );
      }

      // Log the email (mirrors intake pattern)
      const { error: emailLogError } = await supabase.from("email_log").insert({
        docket_id: docket.id,
        email_type: "quote_exact_estimate",
        recipient_email: email,
        subject,
        body_snapshot: htmlBody,
      });

      if (emailLogError) {
        console.error("[Quote] email_log insert failed:", emailLogError.message);
      }
    } catch (err) {
      console.error("[Quote] Email send exception:", err);
      return NextResponse.json(
        { ok: false, error: "Failed to send email" },
        { status: 500 },
      );
    }

    // 8. Return success
    return NextResponse.json({
      ok: true,
      totalDeliveredCAD: breakdown.totalDeliveredCAD,
      reportToken: docket.questions_url_token,
    });
  } catch (err) {
    console.error("[Quote] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

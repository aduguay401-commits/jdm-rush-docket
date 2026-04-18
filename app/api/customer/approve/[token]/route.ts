import { Resend } from "resend";

import { createDepositInvoice } from "@/lib/invoiceStub";
import { createServerClient } from "@/lib/supabase/server";

type ApprovePayload = {
  path?: "private_dealer" | "auction";
  dealer_index?: number;
};

function buildCustomerName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function buildVehicleDescription(
  year: string | number | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
) {
  const normalizedYear =
    typeof year === "number"
      ? String(year)
      : typeof year === "string" && year.trim().length > 0
        ? year.trim()
        : null;

  return [normalizedYear, make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function buildApprovalEmailHtml({
  customerName,
  customerEmail,
  vehicleDescription,
  agreementUrl,
  devMode,
  originalRecipient,
}: {
  customerName: string;
  customerEmail: string;
  vehicleDescription: string;
  agreementUrl: string;
  devMode: boolean;
  originalRecipient: string;
}) {
  const devBanner = devMode
    ? `<p style="margin:0 0 16px;color:#f5c2b3;font-size:13px;">DEV MODE: This email would normally go to ${originalRecipient}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0f0f0f;color:#f5f5f5;font-family:Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f0f0f;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;border-bottom:1px solid #2a2a2a;background:#111111;">
                <img src='https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png' alt='JDM Rush Imports' style='height: 50px; margin-bottom: 32px; display: block;' />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${devBanner}
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#ffffff;">You're in. Let's go get your car. 🎉</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;">Hi ${customerName.split(" ")[0] || customerName}, your approval is locked in for your ${vehicleDescription}.</p>

                <div style="margin:0 0 16px;padding:16px 18px;border:1px solid #2f2f2f;border-radius:10px;background:#171717;">
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#E55125;font-weight:700;letter-spacing:0.04em;">STEP 1: Sign Purchase Agreement</p>
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#d0d0d0;">Please complete the purchase agreement so we can move immediately to final sourcing.</p>
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#E55125;">
                      <a href="${agreementUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Sign Your Purchase Agreement →</a>
                    </td>
                  </tr>
                </table>

                <div style="margin:0 0 16px;padding:16px 18px;border:1px solid #2f2f2f;border-radius:10px;background:#171717;">
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#E55125;font-weight:700;letter-spacing:0.04em;">STEP 2: Submit deposit</p>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#d0d0d0;">Once the agreement is signed, submit your $1,500 CAD deposit to activate sourcing.</p>
                  <div style="border-left:4px solid #E55125;background:#1a1a1a;padding:14px 16px;border-radius:10px;">
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#f0f0f0;">Deposit required: <strong>$1,500 CAD total</strong></p>
                    <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#c8c8c8;">$500 non-refundable</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#c8c8c8;">$1,000 refundable</p>
                  </div>
                </div>

                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#d0d0d0;">Customer: ${customerName} (${customerEmail})</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#d0d0d0;">We will send your first sourcing update within 48-72 hours after both steps are complete.</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9f9f9f;">Need help? Reply to this email or contact support@jdmrushimports.ca.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const payload = (await request.json()) as ApprovePayload;

    if (payload.path !== "private_dealer" && payload.path !== "auction") {
      return Response.json({ success: false, error: "path must be private_dealer or auction" }, { status: 400 });
    }

    if (
      payload.dealer_index !== undefined &&
      (!Number.isInteger(payload.dealer_index) || payload.dealer_index < 1)
    ) {
      return Response.json({ success: false, error: "dealer_index must be a positive integer" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select("*")
      .eq("report_url_token", token)
      .maybeSingle<Record<string, unknown>>();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const currentStatus = typeof docket.status === "string" ? docket.status : null;
    const currentChosenPath =
      typeof docket.chosen_path === "string"
        ? docket.chosen_path
        : typeof docket.selected_path === "string"
          ? docket.selected_path
          : null;

    if (currentStatus === "decision_made" || currentChosenPath) {
      return Response.json(
        { success: false, error: "You've already submitted your approval..." },
        { status: 409 }
      );
    }

    const approvedAt = new Date().toISOString();
    const docketUpdate: Record<string, unknown> = {
      status: "decision_made",
    };

    if (Object.prototype.hasOwnProperty.call(docket, "chosen_path")) {
      docketUpdate.chosen_path = payload.path;
    }

    if (Object.prototype.hasOwnProperty.call(docket, "chosen_dealer_index")) {
      docketUpdate.chosen_dealer_index = payload.dealer_index ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(docket, "selected_path")) {
      docketUpdate.selected_path = payload.path;
    }

    if (Object.prototype.hasOwnProperty.call(docket, "selected_private_dealer_option")) {
      docketUpdate.selected_private_dealer_option = payload.dealer_index ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(docket, "approved_at")) {
      docketUpdate.approved_at = approvedAt;
    }

    const { error: updateError } = await supabase.from("dockets").update(docketUpdate).eq("id", docket.id);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const sequenceInsert: Record<string, unknown> = {
      docket_id: docket.id,
      sequence_type: "C",
      status: "active",
      step: 1,
      next_send_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { error: sequenceError } = await supabase.from("follow_up_sequences").insert(sequenceInsert);

    if (sequenceError) {
      const message = sequenceError.message.toLowerCase();
      const hasMissingColumn = message.includes("column") && message.includes("does not exist");

      if (!hasMissingColumn) {
        return Response.json({ success: false, error: sequenceError.message }, { status: 500 });
      }

      const { error: fallbackSequenceError } = await supabase.from("follow_up_sequences").insert({
        docket_id: docket.id,
        sequence_type: "C",
      });

      if (fallbackSequenceError) {
        return Response.json({ success: false, error: fallbackSequenceError.message }, { status: 500 });
      }
    }

    const customerName = buildCustomerName(
      docket.customer_first_name as string | null,
      docket.customer_last_name as string | null
    ) || "Customer";
    const customerEmail =
      typeof docket.customer_email === "string" && docket.customer_email.trim().length > 0
        ? docket.customer_email
        : "unknown@email.com";
    const vehicleDescription =
      buildVehicleDescription(
        docket.vehicle_year as string | number | null,
        docket.vehicle_make as string | null,
        docket.vehicle_model as string | null
      ) || "vehicle";

    await createDepositInvoice({
      docketId: String(docket.id ?? ""),
      customerName,
      customerEmail,
      vehicleDescription,
      chosenPath: payload.path,
      chosenDealerIndex: payload.dealer_index ?? null,
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
    const devMode = process.env.DEV_MODE === "true";

    if (!resendApiKey || !fromEmail) {
      return Response.json({ success: false, error: "Email configuration is missing" }, { status: 500 });
    }

    const purchaseAgreementUrl =
      payload.path === "private_dealer"
        ? "https://forms.wix.com/r/7191838185536618530"
        : "https://forms.wix.com/r/7211765470112776777";

    const resend = new Resend(resendApiKey);
    const recipientEmail = devMode ? adminEmail : customerEmail;
    const subject = `You're approved — next steps for your ${vehicleDescription}`;
    const html = buildApprovalEmailHtml({
      customerName,
      customerEmail,
      vehicleDescription,
      agreementUrl: purchaseAgreementUrl,
      devMode,
      originalRecipient: customerEmail,
    });

    try {
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html,
      });

      if (sendResult.error) {
        console.error("[Email #5 Send Error]", {
          docketId: docket.id,
          token,
          recipient: recipientEmail,
          error: sendResult.error,
        });
        return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
      }
    } catch (error) {
      console.error("[Email #5 Send Error]", {
        docketId: docket.id,
        token,
        recipient: recipientEmail,
        error,
      });
      return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }

    const { error: emailLogError } = await supabase.from("email_log").insert({
      docket_id: docket.id,
      email_type: "email_5_customer_approval_next_steps",
      recipient_email: recipientEmail,
      subject,
      body_snapshot: html,
    });

    if (emailLogError) {
      return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

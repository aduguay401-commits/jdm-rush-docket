import { requireAdminOrAgent } from "@/lib/admin/auth";
import { sendEmail } from "@/lib/email";
import { createServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/urls";

export const runtime = "nodejs";

type SendAgreementPayload = {
  docketId?: string;
};

type AgreementDocket = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  selected_path: string | null;
  chosen_path?: string | null;
  agreement_sent_at?: string | null;
  agreement_signed: boolean | null;
};

function buildVehicle(docket: AgreementDocket) {
  return [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ") || docket.vehicle_description || "your JDM import";
}

function buildCustomerName(docket: AgreementDocket) {
  return [docket.customer_first_name, docket.customer_last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ") || "there";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildAgreementEmailHtml({
  firstName,
  vehicle,
  signUrl,
  devMode,
  originalRecipient,
}: {
  firstName: string;
  vehicle: string;
  signUrl: string;
  devMode: boolean;
  originalRecipient: string;
}) {
  const devBanner = devMode
    ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${escapeHtml(originalRecipient)}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:20px 24px;border-bottom:1px solid #2a2a2a;">
            <img src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png" alt="JDM Rush Imports" style="height:50px;margin-bottom:24px;display:block;" />
          </td></tr>
          <tr><td style="padding:24px;">
            ${devBanner}
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">Your purchase agreement is ready</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#efefef;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#d6d6d6;">Please review and sign the purchase agreement for ${escapeHtml(vehicle)} in your My JDM Garage account.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td align="center" style="border-radius:999px;background:#E55125;"><a href="${signUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Review and Sign Agreement</a></td></tr></table>
            <p style="margin:0;color:#E55125;font-size:14px;line-height:1.6;">Adam &amp; the JDM Rush Team<br />support@jdmrushimports.ca</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: Request) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as SendAgreementPayload;
  const docketId = typeof payload.docketId === "string" ? payload.docketId : "";

  if (!docketId) {
    return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("id, customer_first_name, customer_last_name, customer_email, vehicle_year, vehicle_make, vehicle_model, vehicle_description, selected_path, chosen_path, agreement_sent_at, agreement_signed")
    .eq("id", docketId)
    .maybeSingle<AgreementDocket>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  if (!docket.customer_email) {
    return Response.json({ success: false, error: "Customer email is missing" }, { status: 400 });
  }

  if (!(docket.chosen_path ?? docket.selected_path)) {
    return Response.json({ success: false, error: "Choose a purchase path before sending the agreement" }, { status: 400 });
  }

  if (docket.agreement_signed) {
    return Response.json({ success: false, error: "Agreement is already signed" }, { status: 409 });
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("dockets")
    .update({ agreement_sent_at: sentAt })
    .eq("id", docket.id);

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 });
  }

  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  if (!fromEmail) {
    return Response.json({ success: false, error: "Email configuration is missing" }, { status: 500 });
  }

  const vehicle = buildVehicle(docket);
  const fullName = buildCustomerName(docket);
  const firstName = fullName.split(/\s+/)[0] || "there";
  const signUrl = `${getAppBaseUrl()}/account/docket/${encodeURIComponent(docket.id)}/sign`;
  const recipientEmail = devMode ? adminEmail : docket.customer_email;
  const subject = `Purchase agreement ready for ${vehicle}`;
  const html = buildAgreementEmailHtml({
    firstName,
    vehicle,
    signUrl,
    devMode,
    originalRecipient: docket.customer_email,
  });
  const textDevPrefix = devMode ? `[DEV MODE] This email would normally go to ${docket.customer_email}\n\n` : "";
  const text = `${textDevPrefix}Hi ${firstName},\n\nPlease review and sign the purchase agreement for ${vehicle}: ${signUrl}\n\nAdam & the JDM Rush Team\nsupport@jdmrushimports.ca`;

  const sendResult = await sendEmail({
    from: fromEmail,
    to: recipientEmail,
    subject,
    html,
    text,
  });

  if (sendResult.error) {
    return Response.json({ success: false, error: "Failed to send agreement email" }, { status: 500 });
  }

  await supabase.from("email_log").insert({
    docket_id: docket.id,
    email_type: "email_6_agreement_sent",
    recipient_email: recipientEmail,
    subject,
    body_snapshot: html,
  });

  return Response.json({ success: true, agreementSentAt: sentAt, signUrl });
}

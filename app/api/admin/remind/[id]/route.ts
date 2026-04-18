import { sendEmail } from '@/lib/email';

import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

function buildVehicleDescription(
  year: string | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
) {
  return [year, make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function buildReminderEmailHtml({
  customerName,
  vehicleDescription,
  devMode,
  originalRecipient,
}: {
  customerName: string;
  vehicleDescription: string;
  devMode: boolean;
  originalRecipient: string;
}) {
  const devBanner = devMode
    ? `<p style=\"margin:0 0 12px;color:#f5c2b3;font-size:13px;\">DEV MODE: This email would normally go to ${originalRecipient}</p>`
    : "";

  return `<!doctype html>
<html lang=\"en\">
  <body style=\"margin:0;background:#0f0f0f;color:#f5f5f5;font-family:Arial,sans-serif;\">
    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background:#0f0f0f;padding:24px 12px;\">
      <tr>
        <td align=\"center\">
          <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width:620px;background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;\">
            <tr>
              <td style=\"padding:22px 24px;border-bottom:1px solid #2a2a2a;background:#111111;\">
                <img src='https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png' alt='JDM Rush Imports' style='height: 50px; margin-bottom: 32px; display: block;' />
              </td>
            </tr>
            <tr>
              <td style=\"padding:24px;\">
                ${devBanner}
                <h1 style=\"margin:0 0 12px;font-size:24px;line-height:1.3;color:#ffffff;\">Following up on your ${vehicleDescription}</h1>
                <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">Hi ${customerName},</p>
                <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">Just checking in on your docket. If anything has changed with your preferences, budget, or timing, reply to this email and we will adjust your search right away.</p>
                <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">We are ready to keep moving your import forward.</p>
                <p style=\"margin:0;font-size:13px;line-height:1.6;color:#9f9f9f;\">JDM Rush Imports</p>
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
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("id, customer_first_name, customer_last_name, customer_email, vehicle_year, vehicle_make, vehicle_model")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      customer_first_name: string | null;
      customer_last_name: string | null;
      customer_email: string | null;
      vehicle_year: string | null;
      vehicle_make: string | null;
      vehicle_model: string | null;
    }>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  if (!docket.customer_email) {
    return Response.json({ success: false, error: "Customer email is missing" }, { status: 400 });
  }
  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  if (!fromEmail) {
    return Response.json({ success: false, error: "Email configuration is missing" }, { status: 500 });
  }
  const customerName = [docket.customer_first_name, docket.customer_last_name].filter(Boolean).join(" ") || "there";
  const vehicleDescription =
    buildVehicleDescription(docket.vehicle_year, docket.vehicle_make, docket.vehicle_model) || "vehicle";
  const recipientEmail = devMode ? adminEmail : docket.customer_email;
  const subject = `Following up on your ${vehicleDescription}`;
  const html = buildReminderEmailHtml({
    customerName,
    vehicleDescription,
    devMode,
    originalRecipient: docket.customer_email,
  });

  try {
    const sendResult = await sendEmail({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html,
      text: `Hi ${customerName},\n\nJust checking in on your ${vehicleDescription}. Reply to this email if anything has changed and we will update your docket right away.\n\nJDM Rush Imports`,
    });

    if (sendResult.error) {
      console.error("[Manual Reminder Send Error]", {
        docketId: docket.id,
        id,
        recipient: recipientEmail,
        error: sendResult.error,
      });
      return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Manual Reminder Send Error]", {
      docketId: docket.id,
      id,
      recipient: recipientEmail,
      error,
    });
    return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }

  const { error: emailLogError } = await supabase.from("email_log").insert({
    docket_id: docket.id,
    email_type: "manual_reminder",
    recipient_email: recipientEmail,
    subject,
    body_snapshot: html,
  });

  if (emailLogError) {
    return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

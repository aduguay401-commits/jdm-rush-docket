import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';

import {
  buildAccountRegisterUrl,
  renderAccountUpsellEmailFooter,
  renderAccountUpsellEmailTextFooter,
} from "@/lib/customer/AccountUpsell";
import { escapeHtml } from "@/lib/html";
import { createServerClient } from "@/lib/supabase/server";
import { getCustomerHomeBaseUrl } from "@/lib/urls";

type SendQuestionsPayload = {
  docketId?: string;
  questions?: string[];
};

function normalizeQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function buildVehicleLabel(
  year: string | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
) {
  return [year, make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function buildQuestionsEmailHtml({
  firstName,
  vehicle,
  questionsUrl,
  accountRegisterUrl,
  devMode,
  originalRecipient,
}: {
  firstName: string;
  vehicle: string;
  questionsUrl: string;
  accountRegisterUrl: string;
  devMode: boolean;
  originalRecipient: string | null;
}) {
  const safeFirstName = escapeHtml(firstName);
  const safeVehicle = escapeHtml(vehicle);
  const safeQuestionsUrl = escapeHtml(questionsUrl);
  const devBanner =
    devMode && originalRecipient
      ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${escapeHtml(originalRecipient)}</div>`
      : "";
  const accountFooter = renderAccountUpsellEmailFooter({ registerUrl: accountRegisterUrl });

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #2a2a2a;">
                <img src='https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png' alt='JDM Rush Imports' style='height: 50px; margin-bottom: 32px; display: block;' />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${devBanner}
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">I have a few quick questions about your JDM request</h1>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#efefef;">Hi ${safeFirstName},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;">I reviewed your ${safeVehicle} request and need a bit more detail before I pull the right auction data and private dealer options.</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#d6d6d6;">
                  <a href="${safeQuestionsUrl}" style="color:#E55125;font-weight:700;text-decoration:none;">Answer these</a>
                </p>
                <p style="margin:0;color:#E55125;font-size:14px;line-height:1.6;">Adam<br />support@jdmrushimports.ca</p>
                ${accountFooter}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SendQuestionsPayload;
    const docketId = typeof payload.docketId === "string" ? payload.docketId : "";
    const questions = normalizeQuestions(payload.questions);

    if (!docketId || questions.length === 0) {
      return Response.json(
        { success: false, error: "docketId and at least one question are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const serviceRoleSupabase = createServerClient();

    const { data: currentDocket, error: currentDocketError } = await supabase
      .from("dockets")
      .select("id, status")
      .eq("id", docketId)
      .maybeSingle<{ id: string; status: string | null }>();

    if (currentDocketError) {
      return Response.json({ success: false, error: currentDocketError.message }, { status: 500 });
    }

    if (!currentDocket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const oldStatus = currentDocket.status;

    const rows = questions.map((questionText) => ({
      docket_id: docketId,
      question_text: questionText,
    }));

    const { error: insertError } = await supabase.from("marcus_questions").insert(rows);

    if (insertError) {
      return Response.json({ success: false, error: insertError.message }, { status: 500 });
    }

    if (oldStatus === "new") {
      const { error: updateError } = await supabase
        .from("dockets")
        .update({ status: "questions_sent" })
        .eq("id", docketId);

      if (updateError) {
        return Response.json({ success: false, error: updateError.message }, { status: 500 });
      }

      const { error: statusHistoryError } = await serviceRoleSupabase.from("docket_status_history").insert({
        docket_id: docketId,
        old_status: oldStatus,
        new_status: "questions_sent",
        changed_by: "agent",
      });

      if (statusHistoryError) {
        return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
      }
    }

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select(
        "id, customer_first_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, questions_url_token"
      )
      .eq("id", docketId)
      .maybeSingle();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    if (!docket.questions_url_token) {
      return Response.json(
        { success: false, error: "Missing questions URL token for docket" },
        { status: 400 }
      );
    }
    const fromEmail = process.env.FROM_EMAIL;
    const devMode = process.env.DEV_MODE === "true";
    const adminEmail = process.env.ADMIN_EMAIL;
    const originalRecipient =
      typeof docket.customer_email === "string" && docket.customer_email.trim().length > 0
        ? docket.customer_email
        : null;
    const recipientEmail = devMode ? adminEmail : originalRecipient;

    if (!fromEmail) {
      return Response.json(
        { success: false, error: "Email configuration is missing" },
        { status: 500 }
      );
    }

    const vehicleLabel =
      buildVehicleLabel(docket.vehicle_year, docket.vehicle_make, docket.vehicle_model);
    const vehicle =
      vehicleLabel && vehicleLabel.length > 5
        ? vehicleLabel
        : typeof docket.vehicle_description === "string"
          ? docket.vehicle_description
          : "vehicle";
    const firstName =
      typeof docket.customer_first_name === "string" && docket.customer_first_name.trim().length > 0
        ? docket.customer_first_name.trim()
        : "there";
    const questionsUrl = getCustomerHomeBaseUrl(docket.questions_url_token);
    const accountRegisterUrl = buildAccountRegisterUrl({
      email: originalRecipient,
      nextPath: `/questions/${docket.questions_url_token}`,
    });
    const subject = "I have a few quick questions about your JDM request";
    const html = buildQuestionsEmailHtml({
      firstName,
      vehicle,
      questionsUrl,
      accountRegisterUrl,
      devMode,
      originalRecipient,
    });
    const textDevPrefix =
      devMode && originalRecipient
        ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n`
        : "";
    const text = `${textDevPrefix}Hi ${firstName},

I reviewed your ${vehicle} request and need a bit more detail before I pull the right auction data and private dealer options.

Answer these: ${questionsUrl}

Adam

${renderAccountUpsellEmailTextFooter({ registerUrl: accountRegisterUrl })}

support@jdmrushimports.ca`;
    try {
      const sendResult = await sendEmail({
        from: `Adam · JDM Rush <${fromEmail}>`,
        to: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
        subject,
        html,
        text,
      });

      if (sendResult.error) {
        console.error("[Email #2 Send Error]", {
          docketId,
          questionsToken: docket.questions_url_token,
          recipient: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
          error: sendResult.error,
        });
        return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
      }
    } catch (error) {
      console.error("[Email #2 Send Error]", {
        docketId,
        questionsToken: docket.questions_url_token,
        recipient: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
        error,
      });
      return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }

    const { error: emailLogError } = await supabase.from("email_log").insert({
      docket_id: docket.id,
      email_type: "email_2_questions_sent",
      recipient_email: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
      subject,
      body_snapshot: html,
    });

    if (emailLogError) {
      return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
    }

    // Send SMS notification alongside email (fire and forget)
    const customerPhone =
      typeof docket.customer_phone === "string" && docket.customer_phone.trim().length > 0
        ? docket.customer_phone
        : null;

    if (!devMode && customerPhone) {
      const smsMessage =
        `JDM Rush: Our export agent has a few quick questions about your ${vehicle} request. ` +
        `Answer here: ${questionsUrl}`;
      try {
        await sendSMS(customerPhone, smsMessage, { docketId: docket.id, smsType: "questions_sent" });
      } catch (smsError) {
        // SMS is secondary to the questions email — never fail the response on it.
        console.error("[SMS] send-questions SMS error (non-blocking):", smsError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[Email #2 Route Error]", { error });
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

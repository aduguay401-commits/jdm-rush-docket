import { sendEmail } from '@/lib/email';

import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

type ReminderCta = {
  message: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
};

function buildReminderCta({
  status,
  questionsUrlToken,
  reportUrlToken,
}: {
  status: string | null;
  questionsUrlToken: string | null;
  reportUrlToken: string | null;
}): ReminderCta {
  if ((status === "questions_sent" || status === "new") && questionsUrlToken) {
    return {
      message:
        "We sent you a few questions to help us find your perfect JDM. Your answers help us narrow down the best options for you.",
      buttonLabel: "Answer Questions →",
      buttonUrl: `https://docket.jdmrushimports.ca/questions/${questionsUrlToken}`,
    };
  }

  if (status === "report_sent" && reportUrlToken) {
    return {
      message:
        "Your personalized import report is ready and waiting. Take a look at the options our team in Japan found for you.",
      buttonLabel: "View Your Report →",
      buttonUrl: `https://docket.jdmrushimports.ca/report/${reportUrlToken}`,
    };
  }

  if (status === "decision_made" && reportUrlToken) {
    return {
      message: "You are almost there! Complete your next steps to lock in your JDM import.",
      buttonLabel: "Complete Next Steps →",
      buttonUrl: `https://docket.jdmrushimports.ca/report/${reportUrlToken}`,
    };
  }

  return {
    message:
      "Just checking in on your docket. If anything has changed with your preferences, budget, or timing, reply to this email and we will adjust your search right away.",
    buttonLabel: null,
    buttonUrl: null,
  };
}

function buildReminderEmailHtml({
  customerName,
  cta,
  devMode,
  originalRecipient,
}: {
  customerName: string;
  cta: ReminderCta;
  devMode: boolean;
  originalRecipient: string;
}) {
  const devBanner = devMode
    ? `<p style=\"margin:0 0 12px;color:#f5c2b3;font-size:13px;\">DEV MODE: This email would normally go to ${originalRecipient}</p>`
    : "";
  const ctaButton =
    cta.buttonLabel && cta.buttonUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#E55125;">
                      <a href="${cta.buttonUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${cta.buttonLabel}</a>
                    </td>
                  </tr>
                </table>`
      : `<p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">Reply to this email and we will follow up right away.</p>`;

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
                <h1 style=\"margin:0 0 12px;font-size:24px;line-height:1.3;color:#ffffff;\">Following up on your JDM request</h1>
                <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">Hi ${customerName},</p>
                <p style=\"margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;\">${cta.message}</p>
                ${ctaButton}
                <p style=\"margin:0;color:#E55125;font-size:14px;line-height:1.6;\">Adam &amp; the JDM Rush Team<br />support@jdmrushimports.ca</p>
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
    .select(
      "id, status, customer_first_name, customer_last_name, customer_email, report_url_token, questions_url_token"
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string | null;
      customer_first_name: string | null;
      customer_last_name: string | null;
      customer_email: string | null;
      report_url_token: string | null;
      questions_url_token: string | null;
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
  const cta = buildReminderCta({
    status: docket.status,
    questionsUrlToken: docket.questions_url_token,
    reportUrlToken: docket.report_url_token,
  });
  const recipientEmail = devMode ? adminEmail : docket.customer_email;
  const subject = "Following up on your JDM request";
  const html = buildReminderEmailHtml({
    customerName,
    cta,
    devMode,
    originalRecipient: docket.customer_email,
  });
  const textDevPrefix = devMode
    ? `DEV MODE: This email would normally go to ${docket.customer_email}\n\n`
    : "";
  const textCta = cta.buttonLabel && cta.buttonUrl
    ? `\n\n${cta.buttonLabel} ${cta.buttonUrl}`
    : "\n\nReply to this email and we will follow up right away.";

  try {
    const sendResult = await sendEmail({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html,
      text: `${textDevPrefix}Hi ${customerName},\n\n${cta.message}${textCta}\n\nAdam & the JDM Rush Team\nsupport@jdmrushimports.ca`,
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

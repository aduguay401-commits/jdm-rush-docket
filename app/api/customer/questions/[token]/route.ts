import { sendEmail } from '@/lib/email';

import { createServerClient } from "@/lib/supabase/server";

type AnswerPayload = {
  answerText?: string;
  questionId?: string;
};

function normalizeAnswers(value: unknown): Array<{ answerText: string; questionId: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const answerText = typeof item?.answerText === "string" ? item.answerText.trim() : "";
      const questionId = typeof item?.questionId === "string" ? item.questionId : "";

      return { answerText, questionId };
    })
    .filter((item) => item.answerText.length > 0 && item.questionId.length > 0);
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

function buildAnswersReceivedEmailHtml({
  firstName,
  vehicle,
  devMode,
  originalRecipient,
}: {
  firstName: string;
  vehicle: string;
  devMode: boolean;
  originalRecipient: string | null;
}) {
  const devBanner =
    devMode && originalRecipient
      ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${originalRecipient}</div>`
      : "";

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
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">Got your answers — we're on it, ${firstName}</h1>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#efefef;">Hi ${firstName},</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#d6d6d6;">Thanks for answering our questions. We have received your answers. Our trusted export agents in Japan are now pulling auction data and private dealer options for your ${vehicle}. We'll be in touch as soon as your custom report is ready - usually within a few business days.</p>
                <p style="margin:0;color:#E55125;font-size:14px;line-height:1.6;">Adam &amp; the JDM Rush Team<br />support@jdmrushimports.ca</p>
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
    const payload = normalizeAnswers(((await request.json()) as AnswerPayload[]) ?? []);

    if (payload.length === 0) {
      return Response.json(
        { success: false, error: "At least one answer is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const serviceRoleSupabase = createServerClient();

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select(
        "id, status, customer_first_name, customer_email, vehicle_year, vehicle_make, vehicle_model"
      )
      .eq("questions_url_token", token)
      .maybeSingle();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const questionIds = payload.map((item) => item.questionId);

    const { data: matchingQuestions, error: questionsError } = await supabase
      .from("marcus_questions")
      .select("id")
      .eq("docket_id", docket.id)
      .in("id", questionIds)
      .is("answered_at", null);

    if (questionsError) {
      return Response.json({ success: false, error: questionsError.message }, { status: 500 });
    }

    if (!matchingQuestions || matchingQuestions.length !== payload.length) {
      return Response.json(
        { success: false, error: "One or more questions could not be updated" },
        { status: 400 }
      );
    }

    const answeredAt = new Date().toISOString();

    for (const item of payload) {
      const { error: updateError } = await supabase
        .from("marcus_questions")
        .update({
          answer_text: item.answerText,
          answered_at: answeredAt,
        })
        .eq("id", item.questionId)
        .eq("docket_id", docket.id);

      if (updateError) {
        return Response.json({ success: false, error: updateError.message }, { status: 500 });
      }
    }

    const { error: statusError } = await supabase
      .from("dockets")
      .update({ status: "answers_received" })
      .eq("id", docket.id);

    if (statusError) {
      return Response.json({ success: false, error: statusError.message }, { status: 500 });
    }

    const { error: statusHistoryError } = await serviceRoleSupabase.from("docket_status_history").insert({
      docket_id: docket.id,
      old_status: docket.status,
      new_status: "answers_received",
      changed_by: "customer",
    });

    if (statusHistoryError) {
      return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
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

    const firstName =
      typeof docket.customer_first_name === "string" && docket.customer_first_name.trim().length > 0
        ? docket.customer_first_name.trim()
        : "there";
    const vehicle =
      buildVehicleLabel(docket.vehicle_year, docket.vehicle_make, docket.vehicle_model) || "vehicle";
    const subject = `Got your answers — we're on it, ${firstName}`;
    const html = buildAnswersReceivedEmailHtml({
      firstName,
      vehicle,
      devMode,
      originalRecipient,
    });
    const textDevPrefix =
      devMode && originalRecipient
        ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n`
        : "";
    const text = `${textDevPrefix}Hi ${firstName},

Thanks for answering our questions. We have received your answers. Our trusted export agents in Japan are now pulling auction data and private dealer options for your ${vehicle}. We'll be in touch as soon as your custom report is ready - usually within a few business days.

Adam & the JDM Rush Team
support@jdmrushimports.ca`;
    try {
      const sendResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
        subject,
        html,
        text,
      });

      if (sendResult.error) {
        console.error("[Email #3 Send Error]", {
          docketId: docket.id,
          token,
          recipient: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
          error: sendResult.error,
        });
        return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
      }
    } catch (error) {
      console.error("[Email #3 Send Error]", {
        docketId: docket.id,
        token,
        recipient: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
        error,
      });
      return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }

    const { error: emailLogError } = await supabase.from("email_log").insert({
      docket_id: docket.id,
      email_type: "email_3_answers_received",
      recipient_email: recipientEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
      subject,
      body_snapshot: html,
    });

    if (emailLogError) {
      return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[Email #3 Route Error]", { error });
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

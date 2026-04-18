import { sendEmail } from '@/lib/email';

import { createServerClient } from "@/lib/supabase/server";

type AskPayload = {
  questionText?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const payload = (await request.json()) as AskPayload;
    const questionText =
      typeof payload.questionText === "string" ? payload.questionText.trim() : "";

    if (!questionText) {
      return Response.json(
        { success: false, error: "questionText is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select("id, customer_first_name, customer_last_name")
      .eq("questions_url_token", token)
      .maybeSingle();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const { error: insertError } = await supabase.from("customer_questions").insert({
      docket_id: docket.id,
      question_text: questionText,
    });

    if (insertError) {
      return Response.json({ success: false, error: insertError.message }, { status: 500 });
    }
    const fromEmail = process.env.FROM_EMAIL;
    const devMode = process.env.DEV_MODE === "true";
    const marcusEmail = devMode ? process.env.ADMIN_EMAIL : process.env.MARCUS_EMAIL;
    const marcusCCEmail = devMode ? null : process.env.MARCUS_CC_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!fromEmail) {
      return Response.json(
        { success: false, error: "Email configuration is missing" },
        { status: 500 }
      );
    }
    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const marcusOriginalEmail = process.env.MARCUS_EMAIL ?? null;
    const marcusDevPrefix =
      devMode && marcusOriginalEmail
        ? `[DEV MODE — This email would normally go to: ${marcusOriginalEmail}]\n\n`
        : "";
    const recipientEmail = marcusEmail ?? adminEmail ?? "adam@jdmrushimports.ca";
    const subject = `Customer submitted a new question for docket ${docket.id}`;
    const bodySnapshot = `${marcusDevPrefix}Customer ${customerName || "Unknown Customer"} sent a question for docket ${docket.id}.

Question:
${questionText}`;

    try {
      const sendResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        ...(marcusCCEmail ? { cc: marcusCCEmail } : {}),
        subject,
        text: bodySnapshot,
      });

      if (sendResult.error) {
        console.error("[Customer Follow-up Question Send Error]", {
          docketId: docket.id,
          token,
          recipient: recipientEmail,
          error: sendResult.error,
        });
        return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
      }

      const { error: emailLogError } = await supabase.from("email_log").insert({
        docket_id: docket.id,
        email_type: "customer_followup_question_sent",
        recipient_email: recipientEmail,
        subject,
        body_snapshot: bodySnapshot,
      });

      if (emailLogError) {
        return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
      }
    } catch (error) {
      console.error("[Customer Follow-up Question Send Error]", {
        docketId: docket.id,
        token,
        recipient: recipientEmail,
        error,
      });
      return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

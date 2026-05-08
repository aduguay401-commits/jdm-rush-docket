import { sendEmail } from '@/lib/email';

import { createServerClient } from "@/lib/supabase/server";

type AskPayload = {
  questionText?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

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
      .select("id, customer_first_name, customer_last_name, customer_email")
      .eq("questions_url_token", token)
      .maybeSingle();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentDuplicate } = await supabase
      .from("customer_questions")
      .select("id")
      .eq("docket_id", docket.id)
      .eq("question_text", questionText)
      .gte("created_at", sixtySecondsAgo)
      .limit(1)
      .maybeSingle();

    if (recentDuplicate) {
      console.log("[ask-us-anything] Duplicate detected within 60s, returning success", {
        docketId: docket.id,
        source: "questions",
      });
      return Response.json({ success: true, duplicate: true }, { status: 200 });
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
    const adminEmail = process.env.ADMIN_EMAIL;
    const marcusEmail = process.env.MARCUS_EMAIL;
    const marcusCCEmail = process.env.MARCUS_CC_EMAIL;

    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const recipientEmail = adminEmail ?? "adam@jdmrushimports.ca";
    const ccRecipients = devMode ? [] : [marcusEmail, marcusCCEmail].filter((value): value is string => Boolean(value));
    const normalRecipientSummary = [recipientEmail, ...ccRecipients].join(", ");
    const devPrefix = devMode ? `[DEV MODE - This email would normally go to: ${normalRecipientSummary}]\n\n` : "";
    const subject = `Customer submitted a new question for docket ${docket.id}`;
    const bodySnapshot = `${devPrefix}Customer ${customerName || "Unknown Customer"} sent a question for docket ${docket.id}.

Docket: ${docket.id}
Customer: ${customerName || "Unknown Customer"}
Customer Email: ${docket.customer_email ?? "Unknown"}

Question:
${questionText}`;

    if (!fromEmail) {
      console.error("[ask-us-anything] Email notification failed", {
        docketId: docket.id,
        source: "questions",
        error: "Email configuration is missing",
      });
      return Response.json({ success: true });
    }

    try {
      const sendResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        ...(ccRecipients.length > 0 ? { cc: ccRecipients.join(", ") } : {}),
        subject,
        text: bodySnapshot,
      });

      if (sendResult.error) {
        console.error("[ask-us-anything] Email notification failed", {
          docketId: docket.id,
          source: "questions",
          error: getErrorMessage(sendResult.error),
        });
        return Response.json({ success: true });
      }

      const { error: emailLogError } = await supabase.from("email_log").insert({
        docket_id: docket.id,
        email_type: "customer_followup_question_sent",
        recipient_email: recipientEmail,
        subject,
        body_snapshot: bodySnapshot,
      });

      if (emailLogError) {
        console.error("[ask-us-anything] Email log failed", {
          docketId: docket.id,
          source: "questions",
          error: emailLogError.message,
        });
      }
    } catch (error) {
      console.error("[ask-us-anything] Email notification failed", {
        docketId: docket.id,
        source: "questions",
        error: getErrorMessage(error),
      });
      return Response.json({ success: true });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

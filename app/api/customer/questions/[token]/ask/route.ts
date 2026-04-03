import { Resend } from "resend";

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

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { success: false, error: "Email configuration is missing" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");

    await resend.emails.send({
      from: fromEmail,
      to: "adam@jdmrushimports.ca",
      subject: `Customer submitted a new question for docket ${docket.id}`,
      text: `Customer ${customerName || "Unknown Customer"} sent a question for docket ${docket.id}.

Question:
${questionText}`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

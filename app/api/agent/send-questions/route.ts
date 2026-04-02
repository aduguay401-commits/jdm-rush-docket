import { Resend } from "resend";

import { createServerClient } from "@/lib/supabase/server";

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

    const rows = questions.map((questionText) => ({
      docket_id: docketId,
      question_text: questionText,
    }));

    const { error: insertError } = await supabase.from("marcus_questions").insert(rows);

    if (insertError) {
      return Response.json({ success: false, error: insertError.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("dockets")
      .update({ status: "questions_sent" })
      .eq("id", docketId);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
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

    await resend.emails.send({
      from: fromEmail,
      to: "adam@jdmrushimports.ca",
      subject: `Marcus submitted questions for docket ${docketId}`,
      text: `Marcus submitted clarifying questions for docket ${docketId}.\n\nQuestions:\n${questions
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n")}\n\nMolty needs to email the customer with these questions.`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

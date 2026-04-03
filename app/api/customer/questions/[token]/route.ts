import { Resend } from "resend";

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

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select(
        "id, customer_first_name, customer_last_name, vehicle_year, vehicle_make, vehicle_model"
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

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const devMode = process.env.DEV_MODE === "true";
    const adminEmail = process.env.ADMIN_EMAIL;

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
    const customerFirstName = docket.customer_first_name?.trim() || "Unknown";
    const customerLastName = docket.customer_last_name?.trim() || "Customer";
    const vehicle = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(" ");

    const notificationRecipients = devMode
      ? [adminEmail ?? "adam@jdmrushimports.ca"]
      : ["marcus@gemmytrading.com", ...(adminEmail ? [adminEmail] : [])];

    await resend.emails.send({
      from: fromEmail,
      to: notificationRecipients,
      ...(!devMode ? { cc: "trade@gemmytrading.com" } : {}),
      subject: `Customer Answers Received — ${customerFirstName} ${customerLastName} — ${vehicle || "Unknown Vehicle"}`,
      text: `Hi Marcus,

Great news — the customer has answered your clarifying questions. Please log in to the docket system to review their answers and proceed with your research.

Customer: ${customerName || `${customerFirstName} ${customerLastName}`}
Vehicle: ${vehicle || "Unknown Vehicle"}

Log in here → https://jdm-rush-docket.vercel.app/agent/login

Thanks,
JDM Rush System`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

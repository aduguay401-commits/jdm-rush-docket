import { Resend } from "resend";

import { createServerClient } from "@/lib/supabase/server";

type ProceedPayload = {
  docketId?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProceedPayload;
    const docketId = typeof payload.docketId === "string" ? payload.docketId : "";

    if (!docketId) {
      return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { error: updateError } = await supabase
      .from("dockets")
      .update({ status: "research_in_progress" })
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
      subject: `Marcus is proceeding to research for docket ${docketId}`,
      text: `Marcus confirmed there are no clarifying questions for docket ${docketId} and is now proceeding to research.`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

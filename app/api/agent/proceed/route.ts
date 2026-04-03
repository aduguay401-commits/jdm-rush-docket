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
    const devMode = process.env.DEV_MODE === "true";
    const marcusEmail = devMode ? process.env.ADMIN_EMAIL : process.env.MARCUS_EMAIL;
    const marcusCCEmail = devMode ? null : process.env.MARCUS_CC_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { success: false, error: "Email configuration is missing" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const marcusOriginalEmail = process.env.MARCUS_EMAIL ?? null;
    const marcusDevPrefix =
      devMode && marcusOriginalEmail
        ? `[DEV MODE — This email would normally go to: ${marcusOriginalEmail}]\n\n`
        : "";

    await resend.emails.send({
      from: fromEmail,
      to: marcusEmail ?? adminEmail ?? "adam@jdmrushimports.ca",
      ...(marcusCCEmail ? { cc: marcusCCEmail } : {}),
      subject: `Marcus is proceeding to research for docket ${docketId}`,
      text: `${marcusDevPrefix}Marcus confirmed there are no clarifying questions for docket ${docketId} and is now proceeding to research.`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

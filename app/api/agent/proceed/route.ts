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

    const { error: updateError } = await supabase
      .from("dockets")
      .update({ status: "research_in_progress" })
      .eq("id", docketId);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const { error: statusHistoryError } = await serviceRoleSupabase.from("docket_status_history").insert({
      docket_id: docketId,
      old_status: oldStatus,
      new_status: "research_in_progress",
      changed_by: "agent",
    });

    if (statusHistoryError) {
      return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
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
    const recipientEmail = marcusEmail ?? adminEmail ?? "adam@jdmrushimports.ca";
    const subject = `Marcus is proceeding to research for docket ${docketId}`;
    const bodySnapshot = `${marcusDevPrefix}Marcus confirmed there are no clarifying questions for docket ${docketId} and is now proceeding to research.`;

    try {
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        ...(marcusCCEmail ? { cc: marcusCCEmail } : {}),
        subject,
        text: bodySnapshot,
      });

      if (sendResult.error) {
        console.error("[Email #4 Send Error]", {
          docketId,
          recipient: recipientEmail,
          error: sendResult.error,
        });
        return Response.json({ success: false, error: "Failed to send email" }, { status: 500 });
      }

      const { error: emailLogError } = await supabase.from("email_log").insert({
        docket_id: docketId,
        email_type: "email_4_proceed_to_research",
        recipient_email: recipientEmail,
        subject,
        body_snapshot: bodySnapshot,
      });

      if (emailLogError) {
        return Response.json({ success: false, error: emailLogError.message }, { status: 500 });
      }
    } catch (error) {
      console.error("[Email #4 Send Error]", {
        docketId,
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

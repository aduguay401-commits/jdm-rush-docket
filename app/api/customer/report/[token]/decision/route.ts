import { Resend } from "resend";

import { createServerClient } from "@/lib/supabase/server";

type DecisionPayload = {
  path?: "private_dealer" | "auction";
  optionNumber?: 1 | 2 | 3;
};

function isValidOptionNumber(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const payload = (await request.json()) as DecisionPayload;

    if (payload.path !== "private_dealer" && payload.path !== "auction") {
      return Response.json({ success: false, error: "path must be private_dealer or auction" }, { status: 400 });
    }

    if (payload.path === "private_dealer" && !isValidOptionNumber(payload.optionNumber)) {
      return Response.json(
        { success: false, error: "optionNumber (1, 2, or 3) is required for private_dealer" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select(
        "id, customer_first_name, customer_last_name, customer_email, vehicle_year, vehicle_make, vehicle_model"
      )
      .eq("report_url_token", token)
      .maybeSingle();

    if (docketError) {
      return Response.json({ success: false, error: docketError.message }, { status: 500 });
    }

    if (!docket) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("dockets")
      .update({
        selected_path: payload.path,
        selected_private_dealer_option:
          payload.path === "private_dealer" ? payload.optionNumber : null,
        status: "decision_made",
      })
      .eq("id", docket.id);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const devMode = process.env.DEV_MODE === "true";

    if (!resendApiKey || !fromEmail) {
      return Response.json({ success: false, error: "Email configuration is missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const vehicle = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(" ");

    const selectionLabel =
      payload.path === "private_dealer"
        ? `Private Dealer (Option ${payload.optionNumber})`
        : "Auction";

    const devPrefix = devMode ? "[DEV MODE]\n\n" : "";

    await resend.emails.send({
      from: fromEmail,
      to: adminEmail ?? "adam@jdmrushimports.ca",
      subject: `Customer decision made for docket ${docket.id}`,
      text: `${devPrefix}A customer made their purchase decision.

Docket: ${docket.id}
Customer: ${customerName || "Unknown Customer"}
Customer Email: ${docket.customer_email ?? "Unknown"}
Vehicle: ${vehicle || "Unknown Vehicle"}
Selected Path: ${selectionLabel}`,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

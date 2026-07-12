import { requireAdminOrAgent } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MoveToDeliveryPayload = {
  docketId?: string;
};

// Agent "Move to Delivery": transitions a docket to sold_in_delivery once BOTH
// close-out gates are green (agreement_signed + deposit_paid). Mirrors the
// /api/agent/proceed pattern (status update + docket_status_history), and adds a
// server-side re-check of the gate so the transition can't be forced past the UI.
// Status changes stay out of the agent PATCH route (which is whitelisted to
// deposit_paid / archive / pin only).
export async function POST(request: Request) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as MoveToDeliveryPayload;
    const docketId = typeof payload.docketId === "string" ? payload.docketId : "";

    if (!docketId) {
      return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: current, error: fetchError } = await supabase
      .from("dockets")
      .select("id, status, agreement_signed, deposit_paid")
      .eq("id", docketId)
      .maybeSingle<{
        id: string;
        status: string | null;
        agreement_signed: boolean | null;
        deposit_paid: boolean | null;
      }>();

    if (fetchError) {
      return Response.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    if (!current) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    // Server-side gate: both conditions must be confirmed.
    if (!current.agreement_signed || !current.deposit_paid) {
      return Response.json(
        {
          success: false,
          error: "Both the signed agreement and the deposit must be confirmed before moving to delivery.",
        },
        { status: 409 },
      );
    }

    // Idempotent: already in delivery.
    if (current.status === "sold_in_delivery") {
      return Response.json({ success: true, status: "sold_in_delivery" });
    }

    const oldStatus = current.status;

    const { error: updateError } = await supabase
      .from("dockets")
      .update({ status: "sold_in_delivery" })
      .eq("id", docketId);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const { error: historyError } = await supabase.from("docket_status_history").insert({
      docket_id: docketId,
      old_status: oldStatus,
      new_status: "sold_in_delivery",
      changed_by: "agent",
    });

    if (historyError) {
      // The status already moved; a history-log failure must not fail the transition.
      console.error("[MoveToDelivery] status history insert failed:", historyError.message);
    }

    return Response.json({ success: true, status: "sold_in_delivery" });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

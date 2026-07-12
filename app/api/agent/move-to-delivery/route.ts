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

    // Compare-and-set: this transition is valid ONLY from decision_made with both
    // gates green. Folding every condition into the UPDATE WHERE makes it atomic —
    // cleared/lost/paused (a backwards move) and already-sold are rejected server-
    // side, and two concurrent submits can never both match (one wins, the other
    // gets zero rows). History is written only after a confirmed 1-row update.
    const { data: moved, error: updateError } = await supabase
      .from("dockets")
      .update({ status: "sold_in_delivery" })
      .eq("id", docketId)
      .eq("status", "decision_made")
      .eq("agreement_signed", true)
      .eq("deposit_paid", true)
      .select("id");

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!moved || moved.length === 0) {
      // Nothing matched: wrong source status (only Decision Made may transition), a
      // gate not confirmed, already in delivery, or a concurrent loser. No history.
      return Response.json(
        {
          success: false,
          error:
            "This docket can only move to delivery from Decision Made with the signed agreement and deposit both confirmed.",
        },
        { status: 409 },
      );
    }

    // Exactly one row transitioned — write the history row exactly once.
    const { error: historyError } = await supabase.from("docket_status_history").insert({
      docket_id: docketId,
      old_status: "decision_made",
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

import { getCurrentUserRole } from "@/lib/admin/auth";
import { isForwardStage, isValidStage } from "@/lib/shipments/stages";
import { isMissingShipmentsTable, SHIPMENT_AGENT_COLUMNS } from "@/lib/shipments/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AdvancePayload = {
  toStage?: string;
  note?: string;
};

// POST /api/agent/shipments/[id]/advance — advance the stage FORWARD-ONLY and
// append a shipment_stage_history row. Backwards/same moves are rejected. A
// compare-and-set on current_stage makes concurrent advances safe.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUserRole();
  if (!auth.user || (auth.role !== "admin" && auth.role !== "agent")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as AdvancePayload;
    const toStage = payload.toStage;
    const note = typeof payload.note === "string" && payload.note.trim().length > 0 ? payload.note.trim() : null;

    if (!isValidStage(toStage)) {
      return Response.json({ success: false, error: "Invalid target stage" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: current, error: fetchError } = await supabase
      .from("shipments")
      .select("id, current_stage")
      .eq("id", id)
      .maybeSingle<{ id: string; current_stage: string | null }>();

    if (fetchError) {
      if (isMissingShipmentsTable(fetchError)) {
        return Response.json({ success: false, enabled: false, error: "Shipment records are not enabled yet." }, { status: 409 });
      }
      return Response.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    if (!current) {
      return Response.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }

    const fromStage = current.current_stage;
    if (!isForwardStage(fromStage, toStage)) {
      return Response.json(
        { success: false, error: "Stages can only move forward." },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();

    // Compare-and-set on the stage we read, so a concurrent advance can't double-apply.
    const { data: moved, error: updateError } = await supabase
      .from("shipments")
      .update({ current_stage: toStage, stage_updated_at: nowIso, updated_at: nowIso })
      .eq("id", id)
      .eq("current_stage", fromStage ?? "pre-shipment")
      .select(SHIPMENT_AGENT_COLUMNS);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }
    if (!moved || moved.length === 0) {
      return Response.json(
        { success: false, error: "The shipment stage changed — reload and try again." },
        { status: 409 },
      );
    }

    const { data: historyRow, error: historyError } = await supabase
      .from("shipment_stage_history")
      .insert({
        shipment_id: id,
        old_stage: fromStage,
        new_stage: toStage,
        changed_by: "agent",
        changed_by_email: auth.user.email ?? null,
        notes: note,
      })
      .select("id, old_stage, new_stage, changed_at, changed_by, notes")
      .maybeSingle();

    if (historyError) {
      console.error("[Shipments] stage history insert failed:", historyError.message);
    }

    return Response.json({ success: true, shipment: moved[0], historyRow: historyRow ?? null });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

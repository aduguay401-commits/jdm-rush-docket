import { requireAdminOrAgent } from "@/lib/admin/auth";
import { isMissingShipmentsTable, SHIPMENT_AGENT_COLUMNS } from "@/lib/shipments/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/agent/shipments?docketId=... — the docket's shipment (full/agent columns)
// plus its stage history. Fail-open: enabled:false if migration 015 has not run.
export async function GET(request: Request) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const docketId = new URL(request.url).searchParams.get("docketId")?.trim() ?? "";
  if (!docketId) {
    return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: shipment, error } = await supabase
    .from("shipments")
    .select(SHIPMENT_AGENT_COLUMNS)
    .eq("docket_id", docketId)
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMissingShipmentsTable(error)) {
      return Response.json({ success: true, enabled: false, shipment: null, history: [] });
    }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  let history: unknown[] = [];
  if (shipment?.id) {
    const { data: historyRows } = await supabase
      .from("shipment_stage_history")
      .select("id, old_stage, new_stage, changed_at, changed_by, notes")
      .eq("shipment_id", shipment.id)
      .order("changed_at", { ascending: false });
    history = historyRows ?? [];
  }

  return Response.json({ success: true, enabled: true, shipment: shipment ?? null, history });
}

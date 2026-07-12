import { requireAdminOrAgent } from "@/lib/admin/auth";
import { isMissingShipmentsTable, SHIPMENT_AGENT_COLUMNS, SHIPMENT_EDITABLE_FIELDS } from "@/lib/shipments/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// PATCH /api/agent/shipments/[id] — edit whitelisted shipment fields. Never
// current_stage (that advances via the guarded forward-only route).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    for (const field of SHIPMENT_EDITABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(payload, field)) {
        continue;
      }
      const value = payload[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        updates[field] = trimmed.length > 0 ? trimmed : null;
      } else {
        updates[field] = value ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: "No valid fields provided" }, { status: 400 });
    }

    const marineTrafficUrl = updates.marine_traffic_url;
    if (typeof marineTrafficUrl === "string" && !/^https?:\/\//i.test(marineTrafficUrl)) {
      return Response.json({ success: false, error: "MarineTraffic URL must start with http(s)://" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("shipments")
      .update(updates)
      .eq("id", id)
      .select(SHIPMENT_AGENT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (isMissingShipmentsTable(error)) {
        return Response.json({ success: false, enabled: false, error: "Shipment records are not enabled yet." }, { status: 409 });
      }
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return Response.json({ success: false, error: "Shipment not found" }, { status: 404 });
    }

    return Response.json({ success: true, shipment: data });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

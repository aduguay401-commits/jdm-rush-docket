import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

type PatchPayload = {
  status?: string | null;
  admin_notes?: string | null;
  is_flagged?: boolean | null;
  is_paused?: boolean | null;
  paused_until?: string | null;
  lost_reason?: string | null;
  estimated_deal_value?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as PatchPayload;
    const supabase = createServerClient();

    const { data: current, error: currentError } = await supabase
      .from("dockets")
      .select("id, status")
      .eq("id", id)
      .maybeSingle<{ id: string; status: string | null }>();

    if (currentError) {
      return Response.json({ success: false, error: currentError.message }, { status: 500 });
    }

    if (!current) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(payload, "status")) {
      updates.status = payload.status;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "admin_notes")) {
      updates.admin_notes = payload.admin_notes;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "is_flagged")) {
      updates.is_flagged = payload.is_flagged;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "is_paused")) {
      updates.is_paused = payload.is_paused;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "paused_until")) {
      updates.paused_until = payload.paused_until;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "lost_reason")) {
      updates.lost_reason = payload.lost_reason;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "estimated_deal_value")) {
      updates.estimated_deal_value = payload.estimated_deal_value;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: "No valid fields provided" }, { status: 400 });
    }

    const oldStatus = current.status;
    const newStatus = Object.prototype.hasOwnProperty.call(updates, "status")
      ? (updates.status as string | null)
      : oldStatus;

    if (newStatus !== oldStatus) {
      const { error: statusHistoryError } = await supabase.from("docket_status_history").insert({
        docket_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: "admin",
      });

      if (statusHistoryError) {
        return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
      }
    }

    const { error: updateError } = await supabase.from("dockets").update(updates).eq("id", id);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

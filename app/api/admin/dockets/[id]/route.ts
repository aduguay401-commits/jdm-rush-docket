import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/admin/auth";

type PatchPayload = {
  status?: string | null;
  admin_notes?: string | null;
  is_flagged?: boolean | null;
  lost_reason?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  research_draft?: Record<string, unknown> | null;
  vehicle_description?: string | null;
};

const MAX_VEHICLE_REQUEST_LENGTH = 500;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentUserRole();
  if (!auth.user || (auth.role !== "admin" && auth.role !== "agent")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as PatchPayload;
    const payloadKeys = Object.keys(payload);

    if (auth.role === "agent" && !payloadKeys.every((key) => key === "research_draft" || key === "vehicle_description")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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

    if (Object.prototype.hasOwnProperty.call(payload, "lost_reason")) {
      updates.lost_reason = payload.lost_reason;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "is_archived")) {
      updates.is_archived = payload.is_archived;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "archived_at")) {
      updates.archived_at = payload.archived_at;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "research_draft")) {
      updates.research_draft = payload.research_draft;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "vehicle_description")) {
      const vehicleDescription =
        typeof payload.vehicle_description === "string" ? payload.vehicle_description.trim() : "";

      if (!vehicleDescription) {
        return Response.json({ success: false, error: "Vehicle request cannot be empty." }, { status: 400 });
      }

      if (vehicleDescription.length > MAX_VEHICLE_REQUEST_LENGTH) {
        return Response.json(
          { success: false, error: `Vehicle request cannot exceed ${MAX_VEHICLE_REQUEST_LENGTH} characters.` },
          { status: 400 }
        );
      }

      updates.vehicle_description = vehicleDescription;
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

    const { data: updatedDocket, error: updateError } = await supabase
      .from("dockets")
      .update(updates)
      .eq("id", id)
      .select("id, vehicle_description")
      .maybeSingle<{ id: string; vehicle_description: string | null }>();

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return Response.json({ success: true, docket: updatedDocket });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

import { requireAdminOrAgent } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PatchPayload = {
  is_archived?: boolean;
  is_flagged?: boolean;
  deposit_paid?: boolean;
};

// Agent-side docket mutations. The admin PATCH route restricts agents to
// research_draft / vehicle_description, so archive + pin need their own authed
// path. MANUAL ONLY — nothing here ever runs without an explicit agent click.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as PatchPayload;

    const updates: Record<string, unknown> = {};

    if (typeof payload.is_archived === "boolean") {
      updates.is_archived = payload.is_archived;
      updates.archived_at = payload.is_archived ? new Date().toISOString() : null;
    }

    if (typeof payload.is_flagged === "boolean") {
      updates.is_flagged = payload.is_flagged;
    }

    if (typeof payload.deposit_paid === "boolean") {
      updates.deposit_paid = payload.deposit_paid;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: "No valid fields provided" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("dockets")
      .update(updates)
      .eq("id", id)
      .select("id, is_archived, archived_at, is_flagged, deposit_paid")
      .maybeSingle<{ id: string; is_archived: boolean | null; archived_at: string | null; is_flagged: boolean | null; deposit_paid: boolean | null }>();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
    }

    return Response.json({ success: true, docket: data });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

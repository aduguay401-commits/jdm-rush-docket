import { getCurrentUserRole } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLLBACK_STATUSES = new Set(["new", "questions_sent", "answers_received"]);

type DocketStatusRow = {
  id: string;
  status: string | null;
};

type StatusHistoryRow = {
  old_status: string | null;
  new_status: string | null;
  changed_at: string | null;
};

function findPreviousCommunicationStatus(history: StatusHistoryRow[]) {
  for (const item of history) {
    if (item.new_status === "research_in_progress" && item.old_status && ALLOWED_ROLLBACK_STATUSES.has(item.old_status)) {
      return item.old_status;
    }
  }

  return null;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUserRole();
  if (!auth.user || (auth.role !== "admin" && auth.role !== "agent")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<DocketStatusRow>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  if (docket.status !== "research_in_progress") {
    return Response.json({ success: false, error: "Cannot roll back from current status" }, { status: 400 });
  }

  const { data: statusHistory, error: statusHistoryError } = await supabase
    .from("docket_status_history")
    .select("old_status, new_status, changed_at")
    .eq("docket_id", id)
    .order("changed_at", { ascending: false })
    .returns<StatusHistoryRow[]>();

  if (statusHistoryError) {
    return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
  }

  const previousStatus = findPreviousCommunicationStatus(statusHistory ?? []);
  if (!previousStatus) {
    return Response.json({ success: false, error: "No previous status to roll back to" }, { status: 500 });
  }

  const { error: updateError } = await supabase.from("dockets").update({ status: previousStatus }).eq("id", id);

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 });
  }

  const changedBy = auth.user.email ?? auth.user.id ?? auth.role;
  const { error: rollbackHistoryError } = await supabase.from("docket_status_history").insert({
    docket_id: id,
    old_status: "research_in_progress",
    new_status: previousStatus,
    changed_by: changedBy,
  });

  if (rollbackHistoryError) {
    return Response.json({ success: false, error: rollbackHistoryError.message }, { status: 500 });
  }

  return Response.json({ success: true, status: previousStatus });
}

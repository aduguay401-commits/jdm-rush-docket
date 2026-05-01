import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/admin/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentUserRole();
  if (!auth.user || auth.role !== "admin") {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
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

  if (current.status !== "lost") {
    const { error: statusHistoryError } = await supabase.from("docket_status_history").insert({
      docket_id: id,
      old_status: current.status,
      new_status: "lost",
      changed_by: "admin",
    });

    if (statusHistoryError) {
      return Response.json({ success: false, error: statusHistoryError.message }, { status: 500 });
    }
  }

  const { data: docket, error: updateError } = await supabase
    .from("dockets")
    .update({ status: "lost" })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true, docket });
}

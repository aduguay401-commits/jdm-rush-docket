import { normalizeAdminDocket } from "@/lib/admin/dockets";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminDocket } from "@/lib/admin/types";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const archivedOnly = new URL(request.url).searchParams.get("archived") === "true";
    const supabase = createServerClient();
    const query = supabase
      .from("dockets")
      .select(
        "id, created_at, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, destination_city, destination_province, budget_bracket, timeline, additional_notes, admin_notes, is_flagged, is_paused, paused_until, lost_reason, estimated_deal_value, marcus_questions_count:marcus_questions(count), customer_questions_count:customer_questions(count), auction_research(*), private_dealer_options(*), follow_up_sequences(*), email_log(*), docket_status_history(*)"
      )
      .order("created_at", { ascending: false });
    const { data, error } = await query.eq("is_archived", archivedOnly);

    if (error) {
      throw new Error(error.message);
    }

    const dockets = ((data ?? []) as AdminDocket[]).map(normalizeAdminDocket);
    return Response.json({ success: true, dockets });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load dockets",
      },
      { status: 500 }
    );
  }
}

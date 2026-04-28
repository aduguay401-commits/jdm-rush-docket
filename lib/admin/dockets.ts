import { createServerClient } from "@/lib/supabase/server";
import type { AdminDocket, CountRelation } from "@/lib/admin/types";

function extractCount(value: CountRelation[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) {
    return 0;
  }

  return typeof value[0]?.count === "number" ? value[0].count : 0;
}

export function normalizeAdminDocket(raw: AdminDocket) {
  return {
    ...raw,
    marcus_questions_total: extractCount(raw.marcus_questions_count),
    customer_questions_total: extractCount(raw.customer_questions_count),
    reminders_sent_total: extractCount(raw.email_log_count),
    estimated_deal_value:
      typeof raw.estimated_deal_value === "number"
        ? raw.estimated_deal_value
        : raw.estimated_deal_value === null
          ? null
          : Number(raw.estimated_deal_value) || null,
    docket_status_history: Array.isArray(raw.docket_status_history)
      ? [...raw.docket_status_history].sort((a, b) => {
          const aTime = new Date(a.created_at ?? 0).getTime();
          const bTime = new Date(b.created_at ?? 0).getTime();
          return bTime - aTime;
        })
      : [],
    marcus_questions: Array.isArray(raw.marcus_questions)
      ? [...raw.marcus_questions].sort((a, b) => {
          const aTime = new Date(a.created_at ?? 0).getTime();
          const bTime = new Date(b.created_at ?? 0).getTime();
          return aTime - bTime;
        })
      : [],
    email_log: Array.isArray(raw.email_log)
      ? [...raw.email_log].sort((a, b) => {
          const aTime = new Date(a.sent_at ?? 0).getTime();
          const bTime = new Date(b.sent_at ?? 0).getTime();
          return bTime - aTime;
        })
      : [],
  };
}

export async function fetchAdminDockets(options?: { archivedOnly?: boolean }) {
  const archivedOnly = options?.archivedOnly ?? false;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("dockets")
    .select(
      "id, created_at, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, destination_city, destination_province, budget_bracket, timeline, additional_notes, admin_notes, is_flagged, is_paused, paused_until, lost_reason, estimated_deal_value, is_archived, archived_at, report_url_token, questions_url_token, marcus_questions_count:marcus_questions(count), customer_questions_count:customer_questions(count), marcus_questions(id, question_text, answer_text, answered_at, created_at), auction_research(*), private_dealer_options(*), follow_up_sequences(*), email_log_count:email_log(count), email_log(*), docket_status_history(*)"
    )
    .eq("is_archived", archivedOnly)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminDocket[]).map(normalizeAdminDocket);
}

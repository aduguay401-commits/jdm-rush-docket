import { createServerClient } from "@/lib/supabase/server";
import type { AdminDocket, CountRelation } from "@/lib/admin/types";

function extractCount(value: CountRelation[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) {
    return 0;
  }

  return typeof value[0]?.count === "number" ? value[0].count : 0;
}

function buildUnreadCountMap(rows: { docket_id: string | null }[] | null | undefined) {
  const unreadCountByDocketId = new Map<string, number>();

  for (const row of rows ?? []) {
    if (!row.docket_id) {
      continue;
    }

    unreadCountByDocketId.set(row.docket_id, (unreadCountByDocketId.get(row.docket_id) ?? 0) + 1);
  }

  return unreadCountByDocketId;
}

export function normalizeAdminDocket(raw: AdminDocket, unreadCount = raw.unreadCount ?? 0) {
  return {
    ...raw,
    unreadCount,
    marcus_questions_total: extractCount(raw.marcus_questions_count),
    customer_questions_total: extractCount(raw.customer_questions_count),
    reminders_sent_total: extractCount(raw.email_log_count),
    docket_status_history: Array.isArray(raw.docket_status_history)
      ? [...raw.docket_status_history].sort((a, b) => {
          const aTime = new Date(a.changed_at ?? 0).getTime();
          const bTime = new Date(b.changed_at ?? 0).getTime();
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
    customer_questions: Array.isArray(raw.customer_questions)
      ? [...raw.customer_questions].sort((a, b) => {
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
      "id, created_at, status, customer_first_name, customer_last_name, customer_email, customer_phone, customer_id, lead_source, lead_source_set_at, lead_source_detail, vehicle_year, vehicle_make, vehicle_model, vehicle_description, destination_city, destination_province, budget_bracket, timeline, additional_notes, admin_notes, is_flagged, lost_reason, is_archived, archived_at, report_url_token, questions_url_token, marcus_questions_count:marcus_questions(count), customer_questions_count:customer_questions(count), marcus_questions(id, question_text, answer_text, answered_at, created_at), customer_questions(id, question_text, answer_text, created_at, read_at), auction_research(*), private_dealer_options(*), follow_up_sequences(*), email_log_count:email_log(count), email_log(*), docket_status_history(*)"
    )
    .eq("is_archived", archivedOnly)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rawDockets = (data ?? []) as AdminDocket[];
  const docketIds = rawDockets.map((docket) => docket.id);

  if (docketIds.length === 0) {
    return [];
  }

  const { data: unreadCustomerQuestions, error: unreadError } = await supabase
    .from("customer_questions")
    .select("docket_id")
    .in("docket_id", docketIds)
    .is("read_at", null);

  if (unreadError) {
    throw new Error(unreadError.message);
  }

  const unreadCountByDocketId = buildUnreadCountMap(unreadCustomerQuestions);
  return rawDockets.map((docket) => normalizeAdminDocket(docket, unreadCountByDocketId.get(docket.id) ?? 0));
}

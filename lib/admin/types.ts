export type CountRelation = { count: number | null };

export type DocketStatusHistoryItem = {
  id: string;
  old_status: string | null;
  new_status: string | null;
  changed_by: string | null;
  created_at: string | null;
};

export type EmailLogItem = {
  id: string;
  sent_at: string | null;
  email_type: string | null;
  recipient_email: string | null;
  subject: string | null;
  body_snapshot: string | null;
  error?: string | null;
};

export type MarcusQuestionItem = {
  id: string;
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string | null;
};

export type AdminDocket = {
  id: string;
  created_at: string;
  status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  destination_city: string | null;
  destination_province: string | null;
  budget_bracket: string | null;
  timeline: string | null;
  additional_notes: string | null;
  admin_notes: string | null;
  is_flagged: boolean | null;
  is_paused: boolean | null;
  paused_until: string | null;
  lost_reason: string | null;
  estimated_deal_value: number | null;
  is_archived: boolean | null;
  archived_at: string | null;
  marcus_questions_count: CountRelation[] | null;
  customer_questions_count: CountRelation[] | null;
  email_log_count: CountRelation[] | null;
  marcus_questions: MarcusQuestionItem[] | null;
  auction_research: Record<string, unknown>[] | null;
  private_dealer_options: Record<string, unknown>[] | null;
  follow_up_sequences: Record<string, unknown>[] | null;
  docket_status_history: DocketStatusHistoryItem[] | null;
  email_log: EmailLogItem[] | null;
};

export type NormalizedAdminDocket = AdminDocket & {
  marcus_questions_total: number;
  customer_questions_total: number;
  reminders_sent_total: number;
  marcus_questions: MarcusQuestionItem[];
  docket_status_history: DocketStatusHistoryItem[];
  email_log: EmailLogItem[];
};

import { notFound, redirect } from "next/navigation";

import CustomerCommunicationTimeline, {
  type TimelineCustomerQuestion,
  type TimelineMarcusQuestion,
} from "@/components/CustomerCommunicationTimeline";
import { getCurrentUserRole } from "@/lib/admin/auth";
import { getProgressBarStage, getStatusDisplay } from "@/lib/dockets/dashboardDisplay";
import { createServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ConversationDocket = {
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
  marcus_questions: TimelineMarcusQuestion[] | null;
  customer_questions: TimelineCustomerQuestion[] | null;
  docket_status_history: { old_status: string | null; new_status: string | null; changed_at: string | null }[] | null;
  email_log: { email_type: string | null; subject: string | null; body_snapshot?: string | null; sent_at: string | null }[] | null;
};

const PROGRESS_STAGES_TOTAL = 6;

function getCustomerName(docket: ConversationDocket) {
  return `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() || "Unnamed Customer";
}

function getVehicleLabel(docket: ConversationDocket) {
  return [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model].filter(Boolean).join(" ") || "N/A";
}

function getProgressStageText(docket: ConversationDocket) {
  const progress = getProgressBarStage(docket.status, docket);
  return `stage ${Math.min(progress.currentIndex + 1, PROGRESS_STAGES_TOTAL)}/${PROGRESS_STAGES_TOTAL}`;
}

export default async function AdminConversationPage({ params }: PageProps) {
  const { user, role } = await getCurrentUserRole();

  if (!user || role !== "admin") {
    redirect("/agent/login");
  }

  const { id } = await params;
  const supabase = createServerClient();
  const { data: docket, error } = await supabase
    .from("dockets")
    .select(
      "id, created_at, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, marcus_questions(id, question_text, answer_text, answered_at, created_at), customer_questions(id, question_text, answer_text, created_at, read_at), docket_status_history(old_status, new_status, changed_at), email_log(email_type, subject, body_snapshot, sent_at)"
    )
    .eq("id", id)
    .maybeSingle<ConversationDocket>();

  if (error) {
    throw new Error(error.message);
  }

  if (!docket) {
    notFound();
  }

  const statusDisplay = getStatusDisplay(docket);
  const vehicleDescription = docket.vehicle_description?.trim() || getVehicleLabel(docket);

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="mb-6 rounded-xl border border-white/10 bg-[#151515] p-5">
          <h1 className="truncate text-2xl font-bold">{getCustomerName(docket)}</h1>
          <p className="mt-2 truncate text-sm text-white/65">
            {docket.customer_email || "N/A"} · {docket.customer_phone || "N/A"}
          </p>
          <p className="mt-1 truncate text-sm text-white/80" title={vehicleDescription}>
            {vehicleDescription}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Currently: {statusDisplay.text} · {getProgressStageText(docket)}
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-[#151515] p-5">
          <CustomerCommunicationTimeline
            customerQuestions={docket.customer_questions ?? []}
            marcusQuestions={docket.marcus_questions ?? []}
          />
        </section>
      </div>
    </main>
  );
}

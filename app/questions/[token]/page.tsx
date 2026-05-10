import { notFound } from "next/navigation";

import { CustomerQuestionsClient } from "./CustomerQuestionsClient";

import type {
  TimelineCustomerQuestion,
  TimelineMarcusQuestion,
} from "@/components/CustomerCommunicationTimeline";
import { getCustomerHomeBaseStatusCopy } from "@/lib/customer/homeBaseStatusCopy";
import { createServerClient } from "@/lib/supabase/server";
import { getCustomerReportUrl } from "@/lib/urls";

export const metadata = {
  title: "Your JDM Home Base | JDM Rush Imports",
};

type CustomerQuestionsPageProps = {
  params: Promise<{ token: string }>;
};

type HomeBaseDocket = {
  id: string;
  status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  vehicle_description: string | null;
  destination_city: string | null;
  destination_province: string | null;
  budget_bracket: string | null;
  timeline: string | null;
  questions_url_token: string | null;
  report_url_token: string | null;
};

export default async function CustomerQuestionsPage({ params }: CustomerQuestionsPageProps) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select(
      "id, status, customer_first_name, customer_last_name, vehicle_description, destination_city, destination_province, budget_bracket, timeline, questions_url_token, report_url_token"
    )
    .eq("questions_url_token", token)
    .maybeSingle<HomeBaseDocket>();

  if (docketError || !docket) {
    notFound();
  }

  const { data: marcusQuestions, error: marcusQuestionsError } = await supabase
    .from("marcus_questions")
    .select("id, question_text, answer_text, answered_at, created_at")
    .eq("docket_id", docket.id)
    .order("created_at", { ascending: true })
    .returns<TimelineMarcusQuestion[]>();

  const { data: customerQuestions, error: customerQuestionsError } = await supabase
    .from("customer_questions")
    .select("id, question_text, answer_text, created_at, read_at")
    .eq("docket_id", docket.id)
    .order("created_at", { ascending: true })
    .returns<TimelineCustomerQuestion[]>();

  if (marcusQuestionsError || customerQuestionsError) {
    notFound();
  }

  const allMarcusQuestions = marcusQuestions ?? [];
  const unansweredQuestions = allMarcusQuestions.filter((question) => !question.answer_text?.trim());
  const customerName = [docket.customer_first_name, docket.customer_last_name]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  const firstName = docket.customer_first_name?.trim() || customerName.trim().split(/\s+/)[0] || "there";
  const statusCopy = getCustomerHomeBaseStatusCopy(docket.status, firstName);
  const shouldShowQuestionForm = (statusCopy.showQuestionForm || unansweredQuestions.length > 0) && unansweredQuestions.length > 0;
  const reportUrl =
    statusCopy.showReportLink && docket.report_url_token ? getCustomerReportUrl(docket.report_url_token) : null;

  return (
    <CustomerQuestionsClient
      askEndpoint={`/api/customer/questions/${token}/ask`}
      customerQuestions={customerQuestions ?? []}
      docket={docket}
      reportUrl={reportUrl}
      shouldShowQuestionForm={shouldShowQuestionForm}
      statusCopy={{
        ...statusCopy,
        showQuestionForm: shouldShowQuestionForm,
        showReportLink: Boolean(reportUrl),
      }}
      submitEndpoint={`/api/customer/questions/${token}`}
      unansweredQuestions={unansweredQuestions ?? []}
      allMarcusQuestions={allMarcusQuestions}
    />
  );
}

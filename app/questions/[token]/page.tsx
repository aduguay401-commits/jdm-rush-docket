import { notFound } from "next/navigation";

import { CustomerQuestionsClient } from "./CustomerQuestionsClient";

import { createServerClient } from "@/lib/supabase/server";

type CustomerQuestionsPageProps = {
  params: Promise<{ token: string }>;
};

export default async function CustomerQuestionsPage({ params }: CustomerQuestionsPageProps) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("id, customer_first_name, customer_last_name")
    .eq("questions_url_token", token)
    .maybeSingle();

  if (docketError || !docket) {
    notFound();
  }

  const { data: unansweredQuestions, error: questionsError } = await supabase
    .from("marcus_questions")
    .select("id, question_text")
    .eq("docket_id", docket.id)
    .is("answered_at", null)
    .order("created_at", { ascending: true });

  if (questionsError) {
    notFound();
  }

  const customerName = [docket.customer_first_name, docket.customer_last_name]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  return (
    <CustomerQuestionsClient
      askEndpoint={`/api/customer/questions/${token}/ask`}
      customerName={customerName}
      submitEndpoint={`/api/customer/questions/${token}`}
      unansweredQuestions={unansweredQuestions ?? []}
    />
  );
}

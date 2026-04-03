"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Docket = {
  id: string;
  questions_url_token: string | null;
  status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  budget_bracket: string | null;
  destination_city: string | null;
  destination_province: string | null;
  timeline: string | null;
  additional_notes: string | null;
};

type CustomerAnswer = {
  id: string;
  question_text: string;
  answer_text: string | null;
};

const MAX_QUESTIONS = 10;

async function getUserRole(userId: string, supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (byId.data?.role) {
    return byId.data.role as string;
  }

  const byUserId = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId.data?.role) {
    return byUserId.data.role as string;
  }

  return null;
}

export default function AgentDocketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [loading, setLoading] = useState(true);
  const [docket, setDocket] = useState<Docket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState(["", "", ""]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [questionsConfirmation, setQuestionsConfirmation] = useState<string | null>(null);
  const [proceedConfirmation, setProceedConfirmation] = useState<string | null>(null);
  const [customerAnswers, setCustomerAnswers] = useState<CustomerAnswer[]>([]);

  const isResearchInProgress = docket?.status === "research_in_progress";
  const isAnswersReceived = docket?.status === "answers_received";

  useEffect(() => {
    async function loadDocket() {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse.user;

      if (!user) {
        router.replace("/agent/login");
        return;
      }

      const role = await getUserRole(user.id, supabase);

      if (role !== "agent" && role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/agent/login");
        return;
      }

      const { data, error: docketError } = await supabase
        .from("dockets")
        .select(
          "id, questions_url_token, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, budget_bracket, destination_city, destination_province, timeline, additional_notes"
        )
        .eq("id", id)
        .maybeSingle();

      if (docketError || !data) {
        setError(docketError?.message ?? "Docket not found.");
        setLoading(false);
        return;
      }

      setDocket(data as Docket);

      const { data: answersData, error: answersError } = await supabase
        .from("marcus_questions")
        .select("id, question_text, answer_text")
        .eq("docket_id", id)
        .not("answered_at", "is", null)
        .order("created_at", { ascending: true });

      if (answersError) {
        setError(answersError.message);
        setLoading(false);
        return;
      }

      setCustomerAnswers((answersData ?? []) as CustomerAnswer[]);
      setLoading(false);
    }

    void loadDocket();
  }, [id, router, supabase]);

  function updateQuestion(index: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addQuestionField() {
    if (isResearchInProgress) {
      return;
    }

    setQuestions((prev) => {
      if (prev.length >= MAX_QUESTIONS) {
        return prev;
      }

      return [...prev, ""];
    });
  }

  async function sendQuestions() {
    if (isResearchInProgress) {
      return;
    }

    const cleanedQuestions = questions.map((question) => question.trim()).filter(Boolean);

    if (cleanedQuestions.length === 0) {
      setError("Enter at least one question before sending.");
      return;
    }

    setSavingQuestions(true);
    setError(null);
    setQuestionsConfirmation(null);

    const response = await fetch("/api/agent/send-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        docketId: id,
        questions: cleanedQuestions,
      }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to send questions.");
      setSavingQuestions(false);
      return;
    }

    setDocket((prev) => (prev ? { ...prev, status: "questions_sent" } : prev));
    const customerQuestionsLink = docket?.questions_url_token
      ? `https://jdm-rush-docket.vercel.app/questions/${docket.questions_url_token}`
      : null;

    setQuestionsConfirmation(
      customerQuestionsLink
        ? `Questions sent successfully. Docket status updated to questions_sent.\nCustomer Questions Link: ${customerQuestionsLink}`
        : "Questions sent successfully. Docket status updated to questions_sent."
    );
    setSavingQuestions(false);
  }

  async function proceedWithoutQuestions() {
    if (isResearchInProgress || proceeding) {
      return;
    }

    setProceeding(true);
    setError(null);
    setProceedConfirmation(null);

    const response = await fetch("/api/agent/proceed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ docketId: id }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setError(result.error ?? "Failed to update docket.");
      setProceeding(false);
      return;
    }

    setDocket((prev) => (prev ? { ...prev, status: "research_in_progress" } : prev));
    setProceedConfirmation(
      "✅ Confirmed — you're ready to proceed to research. The research input form will appear here in the next update."
    );
    setProceeding(false);
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b border-white/10 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#E55125]">JDM Rush</p>
          <h1 className="mt-2 text-3xl font-semibold">Docket Details</h1>
        </header>

        {loading ? <p className="text-white/75">Loading docket...</p> : null}
        {error ? <p className="text-red-400">{error}</p> : null}
        {questionsConfirmation ? (
          <p className="whitespace-pre-line text-emerald-400">{questionsConfirmation}</p>
        ) : null}

        {!loading && docket ? (
          <>
            <div>
              <Link
                className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                href="/agent/dashboard"
              >
                ← Back to Dockets
              </Link>
            </div>

            <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
              <h2 className="mb-4 text-xl font-semibold">Sales Lead Information</h2>
              <div className="grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                <p>
                  <span className="text-white">Name:</span> {docket.customer_first_name || ""} {docket.customer_last_name || ""}
                </p>
                <p>
                  <span className="text-white">Email:</span> {docket.customer_email || "N/A"}
                </p>
                <p>
                  <span className="text-white">Phone:</span> {docket.customer_phone || "N/A"}
                </p>
                <p>
                  <span className="text-white">Vehicle:</span>{" "}
                  {[docket.vehicle_year, docket.vehicle_make, docket.vehicle_model].filter(Boolean).join(" ") || "N/A"}
                </p>
                <p>
                  <span className="text-white">Budget:</span> {docket.budget_bracket || "N/A"}
                </p>
                <p>
                  <span className="text-white">Destination:</span>{" "}
                  {[docket.destination_city, docket.destination_province].filter(Boolean).join(", ") || "N/A"}
                </p>
                <p>
                  <span className="text-white">Timeline:</span> {docket.timeline || "N/A"}
                </p>
                <p>
                  <span className="text-white">Current Status:</span> {docket.status || "new"}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-white">Additional Notes:</span> {docket.additional_notes || "N/A"}
                </p>
              </div>
            </section>

            {isAnswersReceived ? (
              <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
                <h2 className="mb-4 text-xl font-semibold">Customer Answers</h2>
                {customerAnswers.length === 0 ? (
                  <p className="text-sm text-white/70">No customer answers found.</p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {customerAnswers.map((item) => (
                      <div className="py-4 first:pt-0 last:pb-0" key={item.id}>
                        <p className="text-sm text-white">{item.question_text}</p>
                        <p className="mt-2 text-sm text-[#E55125]">{item.answer_text || "No answer provided."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            <section
              className={`rounded-xl border border-white/12 bg-[#171717] p-5 ${isResearchInProgress ? "opacity-70" : ""}`}
            >
              <h2 className="mb-4 text-xl font-semibold">Questions for Customer</h2>
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <label className="block text-sm text-white/85" key={`question-${index + 1}`}>
                    Question {index + 1}
                    <input
                      className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                      disabled={isResearchInProgress}
                      onChange={(event) => updateQuestion(index, event.target.value)}
                      placeholder={`Question ${index + 1}`}
                      type="text"
                      value={question}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isResearchInProgress || questions.length >= MAX_QUESTIONS}
                  onClick={addQuestionField}
                  type="button"
                >
                  + Add Question
                </button>
                <button
                  className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isResearchInProgress || savingQuestions}
                  onClick={sendQuestions}
                  type="button"
                >
                  {savingQuestions ? "Sending..." : "Send Questions to Customer"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
              <h2 className="mb-4 text-xl font-semibold">
                {isAnswersReceived ? "Ready to Proceed?" : "Proceed Without Questions"}
              </h2>
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isResearchInProgress || proceeding}
                onClick={proceedWithoutQuestions}
                type="button"
              >
                {proceeding
                  ? "Confirming..."
                  : isAnswersReceived
                    ? "I've reviewed the answers — Proceed to Research"
                    : "I have all the information I need"}
              </button>
              {proceedConfirmation ? <p className="mt-3 text-sm text-emerald-400">{proceedConfirmation}</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

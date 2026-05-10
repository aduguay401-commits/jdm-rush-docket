"use client";

import { useMemo, useState } from "react";

import CustomerCommunicationTimeline, {
  type TimelineCustomerQuestion,
  type TimelineMarcusQuestion,
} from "@/components/CustomerCommunicationTimeline";
import MarkdownMessage from "@/components/MarkdownMessage";
import type { CustomerHomeBaseStatusCopy } from "@/lib/customer/homeBaseStatusCopy";

type Question = {
  id: string;
  question_text: string | null;
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

type CustomerQuestionsClientProps = {
  allMarcusQuestions: TimelineMarcusQuestion[];
  askEndpoint: string;
  customerQuestions: TimelineCustomerQuestion[];
  docket: HomeBaseDocket;
  reportUrl: string | null;
  shouldShowQuestionForm: boolean;
  statusCopy: CustomerHomeBaseStatusCopy;
  submitEndpoint: string;
  unansweredQuestions: Question[];
};

const LOGO_URL =
  "https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png";

const STATUS_LABELS: Record<string, string> = {
  new: "Request received",
  questions_sent: "Questions ready",
  answers_received: "Answers received",
  research_in_progress: "Research underway",
  report_sent: "Report ready",
  decision_made: "Decision received",
  cleared: "Project complete",
  paused: "Paused",
  unresponsive: "Waiting to hear from you",
  lost: "No longer active",
};

const toneStyles = {
  active: "border-[#E55125]/35 bg-[#E55125]/10 shadow-[0_18px_60px_rgba(229,81,37,0.14)]",
  waiting: "border-white/12 bg-white/[0.045]",
  closed: "border-white/10 bg-[#151515]",
} satisfies Record<CustomerHomeBaseStatusCopy["tone"], string>;

function getStageLabel(status: string | null) {
  return STATUS_LABELS[status ?? "new"] ?? "Project update";
}

function getDestination(docket: HomeBaseDocket) {
  return [docket.destination_city, docket.destination_province].filter(Boolean).join(", ") || "Not specified";
}

function formatSummaryValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Not specified";
}

function hasConversation(marcusQuestions: TimelineMarcusQuestion[], customerQuestions: TimelineCustomerQuestion[]) {
  return (
    marcusQuestions.some((question) => question.answer_text?.trim() || question.answered_at) ||
    customerQuestions.length > 0
  );
}

export function CustomerQuestionsClient({
  allMarcusQuestions,
  askEndpoint,
  customerQuestions,
  docket,
  reportUrl,
  shouldShowQuestionForm,
  statusCopy,
  submitEndpoint,
  unansweredQuestions,
}: CustomerQuestionsClientProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(unansweredQuestions.map((question) => [question.id, ""]))
  );
  const [questionForTeam, setQuestionForTeam] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [answersSubmitted, setAnswersSubmitted] = useState(false);
  const [askSuccess, setAskSuccess] = useState<string | null>(null);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);

  const currentUnansweredQuestions = useMemo(
    () => (answersSubmitted ? [] : unansweredQuestions),
    [answersSubmitted, unansweredQuestions]
  );
  const shouldRenderQuestionForm = shouldShowQuestionForm && currentUnansweredQuestions.length > 0;
  const conversationExists = hasConversation(allMarcusQuestions, customerQuestions) || answersSubmitted;

  const allAnswersFilled = useMemo(
    () =>
      currentUnansweredQuestions.every((question) => {
        const answer = answers[question.id];
        return typeof answer === "string" && answer.trim().length > 0;
      }),
    [answers, currentUnansweredQuestions]
  );

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function submitAnswers() {
    if (!shouldRenderQuestionForm || isSubmittingAnswers) {
      return;
    }

    if (!allAnswersFilled) {
      setAnswerError("Please answer each question before submitting.");
      return;
    }

    setIsSubmittingAnswers(true);
    setAnswerError(null);

    try {
      const payload = currentUnansweredQuestions.map((question) => ({
        questionId: question.id,
        answerText: answers[question.id].trim(),
      }));

      const response = await fetch(submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok || !result.success) {
        setAnswerError(result.error ?? "Failed to submit your answers.");
        setIsSubmittingAnswers(false);
        return;
      }

      setAnswersSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setIsSubmittingAnswers(false);
    } catch {
      setAnswerError("Failed to submit your answers.");
      setIsSubmittingAnswers(false);
    }
  }

  async function submitCustomerQuestion() {
    const trimmedQuestion = questionForTeam.trim();

    if (!trimmedQuestion) {
      setAskError("Enter your question before sending it.");
      return;
    }

    setIsSendingQuestion(true);
    setAskError(null);
    setAskSuccess(null);

    const response = await fetch(askEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ questionText: trimmedQuestion }),
    });

    const result = (await response.json()) as { error?: string; success?: boolean };

    if (!response.ok || !result.success) {
      setAskError(result.error ?? "Failed to send your question.");
      setIsSendingQuestion(false);
      return;
    }

    setQuestionForTeam("");
    setAskSuccess("Your question has been sent. We will follow up shortly.");
    setIsSendingQuestion(false);
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-5 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[680px]">
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="JDM Rush Imports" className="mx-auto h-[50px] w-auto" src={LOGO_URL} />
        </header>

        <div className="mt-10 space-y-5">
          {answersSubmitted ? (
            <section className="rounded-lg border-l-4 border-[#E55125] bg-[#1a1a1a] p-5">
              <p className="text-sm leading-7 text-white/88">
                Your answers have been submitted. Our team is reviewing what you sent and will follow up shortly.
              </p>
            </section>
          ) : null}

          <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E55125]">Your JDM Home Base</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-[2.2rem]">{statusCopy.heading}</h1>
            <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base">{statusCopy.message}</p>
          </section>

          <section className={`rounded-[20px] border p-5 transition ${toneStyles[statusCopy.tone]}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Current stage</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{getStageLabel(docket.status)}</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              {shouldRenderQuestionForm
                ? `${currentUnansweredQuestions.length} ${currentUnansweredQuestions.length === 1 ? "question needs" : "questions need"} your reply.`
                : statusCopy.message}
            </p>
          </section>

          {reportUrl ? (
            <section className="rounded-[20px] border border-[#E55125]/35 bg-[#E55125]/10 p-5">
              <p className="text-sm text-white/70">See the JDM options we found for you</p>
              <a
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
                href={reportUrl}
              >
                View Your Custom Report →
              </a>
            </section>
          ) : null}

          {docket.status === "new" ? (
            <section className="rounded-[20px] border border-white/10 bg-[#141414] p-5">
              <h2 className="text-xl font-semibold text-white">Original Request</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-white/45">Vehicle</dt>
                  <dd className="mt-1 text-white/88">{formatSummaryValue(docket.vehicle_description)}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Destination</dt>
                  <dd className="mt-1 text-white/88">{getDestination(docket)}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Budget</dt>
                  <dd className="mt-1 text-white/88">{formatSummaryValue(docket.budget_bracket)}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Timeline</dt>
                  <dd className="mt-1 text-white/88">{formatSummaryValue(docket.timeline)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {shouldRenderQuestionForm ? (
            <section className="rounded-[20px] border border-white/10 bg-[#141414] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white">Questions</h2>
                <span className="text-sm text-white/45">{currentUnansweredQuestions.length} pending</span>
              </div>

              <div className="mt-6 space-y-5">
                {answerError ? <p className="text-sm text-red-400">{answerError}</p> : null}
                {currentUnansweredQuestions.map((question, index) => (
                  <label className="block" key={question.id}>
                    <div className="flex gap-2 text-sm font-medium text-white/80">
                      <span aria-hidden="true" className="shrink-0">
                        {index + 1}.
                      </span>
                      <MarkdownMessage
                        className="min-w-0 flex-1 font-medium text-white/80"
                        content={question.question_text}
                      />
                    </div>
                    <textarea
                      className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                      disabled={isSubmittingAnswers}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      placeholder="Type your answer here"
                      value={answers[question.id] ?? ""}
                    />
                  </label>
                ))}

                <button
                  className="w-full rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmittingAnswers}
                  onClick={submitAnswers}
                  type="button"
                >
                  {isSubmittingAnswers ? "Submitting..." : "Submit Answers"}
                </button>
              </div>
            </section>
          ) : null}

          {conversationExists ? (
            <section className="rounded-[20px] border border-white/10 bg-[#141414] p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white">Your Conversation with JDM Rush</h2>
              <div className="mt-5">
                <CustomerCommunicationTimeline
                  customerQuestions={customerQuestions}
                  marcusQuestions={allMarcusQuestions}
                  perspective="customer"
                  readOnly={true}
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-[20px] border border-white/10 bg-[#141414] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Got a question? Ask anytime</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              We are here to help - send us a message and we will get back to you.
            </p>

            <div className="mt-5">
              <textarea
                className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                disabled={isSendingQuestion}
                onChange={(event) => setQuestionForTeam(event.target.value)}
                placeholder="Type your question or extra details"
                value={questionForTeam}
              />
            </div>

            {askError ? <p className="mt-4 text-sm text-red-400">{askError}</p> : null}
            {askSuccess ? <p className="mt-4 text-sm text-emerald-400">{askSuccess}</p> : null}

            <button
              className="mt-5 rounded-2xl border border-[#E55125] px-5 py-3 text-sm font-semibold text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSendingQuestion}
              onClick={submitCustomerQuestion}
              type="button"
            >
              {isSendingQuestion ? "Sending..." : "Send My Question"}
            </button>
          </section>

          <footer className="pb-4 pt-2 text-center text-xs leading-6 text-white/45">
            <p>Save this link - it is your JDM Home Base for the entire project.</p>
            <p>support@jdmrushimports.ca</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

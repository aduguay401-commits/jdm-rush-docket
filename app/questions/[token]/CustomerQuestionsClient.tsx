"use client";

import { useMemo, useState } from "react";

import CustomerCommunicationTimeline, {
  type TimelineCustomerQuestion,
  type TimelineMarcusQuestion,
} from "@/components/CustomerCommunicationTimeline";
import MarkdownMessage from "@/components/MarkdownMessage";
import { AccountUpsellPanel } from "@/lib/customer/AccountUpsell";
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
  customer_email: string | null;
  vehicle_description: string | null;
  destination_city: string | null;
  destination_province: string | null;
  budget_bracket: string | null;
  timeline: string | null;
  questions_url_token: string | null;
  report_url_token: string | null;
};

type CustomerQuestionsClientProps = {
  accountRegisterUrl: string;
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

const toneStyles = {
  active: "border-[#E55125]/35 bg-[#E55125]/10 shadow-[0_18px_60px_rgba(229,81,37,0.14)]",
  waiting: "border-white/12 bg-white/[0.045]",
  closed: "border-white/10 bg-[#151515]",
} satisfies Record<CustomerHomeBaseStatusCopy["tone"], string>;

const tagStyles = {
  active: "text-[#E55125]",
  waiting: "text-white/48",
  closed: "text-white/45",
} satisfies Record<CustomerHomeBaseStatusCopy["tone"], string>;

function getDestination(docket: HomeBaseDocket) {
  return [docket.destination_city, docket.destination_province].filter(Boolean).join(", ") || "Not specified";
}

function formatSummaryValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Not specified";
}

function formatMessageTimestamp(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toLocaleString() : "Unknown time";
}

function getTimelineMessageCount(
  marcusQuestions: TimelineMarcusQuestion[],
  customerQuestions: TimelineCustomerQuestion[]
) {
  const agentQuestionBatchCount = new Set(
    marcusQuestions.filter((question) => question.created_at).map((question) => question.created_at)
  ).size;
  const customerAnswerBatchCount = new Set(
    marcusQuestions.filter((question) => question.answered_at).map((question) => question.answered_at)
  ).size;
  const customerQuestionCount = customerQuestions.length;
  const customerQuestionReplyCount = customerQuestions.filter((question) => question.answer_text?.trim()).length;

  return agentQuestionBatchCount + customerAnswerBatchCount + customerQuestionCount + customerQuestionReplyCount;
}

function getLatestTimelineTimestamp(
  marcusQuestions: TimelineMarcusQuestion[],
  customerQuestions: TimelineCustomerQuestion[]
) {
  const timestamps = [
    ...marcusQuestions.flatMap((question) => [question.created_at, question.answered_at]),
    ...customerQuestions.map((question) => question.created_at),
  ].filter((timestamp): timestamp is string => Boolean(timestamp));

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.reduce((latest, timestamp) =>
    new Date(timestamp).getTime() > new Date(latest).getTime() ? timestamp : latest
  );
}

function formatRelativeMessageTime(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 text-[#E55125] transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function CustomerQuestionsClient({
  accountRegisterUrl,
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
  const [isConversationExpanded, setIsConversationExpanded] = useState(false);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const customerFirstName = docket.customer_first_name?.trim() || "there";

  const currentUnansweredQuestions = useMemo(
    () => (answersSubmitted ? [] : unansweredQuestions),
    [answersSubmitted, unansweredQuestions]
  );
  const displayedStatusCopy: CustomerHomeBaseStatusCopy = answersSubmitted
    ? {
        tag: "WE GOT YOUR ANSWERS",
        heading: "We are on it",
        message: "Our team is reviewing what you sent and will follow up shortly.",
        showReportLink: false,
        showQuestionForm: false,
        tone: "active",
      }
    : statusCopy;
  const shouldRenderQuestionForm = shouldShowQuestionForm && currentUnansweredQuestions.length > 0;
  const latestUnansweredQuestionTimestamp = useMemo(() => {
    if (currentUnansweredQuestions.length === 0) {
      return null;
    }

    return currentUnansweredQuestions.reduce<string | null>((latest, question) => {
      const matchingQuestion = allMarcusQuestions.find((marcusQuestion) => marcusQuestion.id === question.id);
      const timestamp = matchingQuestion?.created_at ?? null;

      if (!timestamp || !latest) {
        return timestamp ?? latest;
      }

      return new Date(timestamp).getTime() > new Date(latest).getTime() ? timestamp : latest;
    }, null);
  }, [allMarcusQuestions, currentUnansweredQuestions]);
  const latestUnansweredQuestions = useMemo(() => {
    if (!latestUnansweredQuestionTimestamp) {
      return currentUnansweredQuestions;
    }

    const unansweredQuestionIds = new Set(currentUnansweredQuestions.map((question) => question.id));
    return allMarcusQuestions
      .filter(
        (question) =>
          unansweredQuestionIds.has(question.id) && question.created_at === latestUnansweredQuestionTimestamp
      )
      .map((question) => ({
        id: question.id,
        question_text: question.question_text,
      }));
  }, [allMarcusQuestions, currentUnansweredQuestions, latestUnansweredQuestionTimestamp]);
  const shouldRenderLatestMessageCard = shouldRenderQuestionForm && latestUnansweredQuestions.length > 0;
  const shouldFilterUnansweredFromTimeline = shouldRenderLatestMessageCard || answersSubmitted;
  const timelineMarcusQuestions = useMemo(
    () =>
      shouldFilterUnansweredFromTimeline
        ? allMarcusQuestions.filter((question) => question.answer_text?.trim() || question.answered_at)
        : allMarcusQuestions,
    [allMarcusQuestions, shouldFilterUnansweredFromTimeline]
  );
  const conversationMessageCount = getTimelineMessageCount(timelineMarcusQuestions, customerQuestions);
  const latestConversationTimestamp = getLatestTimelineTimestamp(timelineMarcusQuestions, customerQuestions);
  const conversationRelativeTime = formatRelativeMessageTime(latestConversationTimestamp);
  const conversationSummary =
    conversationMessageCount === 0
      ? "No messages yet"
      : `${conversationMessageCount} ${conversationMessageCount === 1 ? "message" : "messages"}${
          conversationRelativeTime ? `, last ${conversationRelativeTime}` : ""
        }`;
  const shouldShowReportCta = displayedStatusCopy.showReportLink && Boolean(reportUrl);

  const allAnswersFilled = useMemo(
    () =>
      latestUnansweredQuestions.every((question) => {
        const answer = answers[question.id];
        return typeof answer === "string" && answer.trim().length > 0;
      }),
    [answers, latestUnansweredQuestions]
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
      const payload = latestUnansweredQuestions.map((question) => ({
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
    <main className="min-h-screen bg-[#111111] px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[680px]">
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="JDM Rush Imports" className="mx-auto h-10 w-auto" src={LOGO_URL} />
        </header>

        <div className="mt-8 space-y-5">
          <section className="text-center">
            <h1 className="text-[#E55125] font-extrabold tracking-tight leading-none text-center" style={{ fontSize: "clamp(26px, 5vw, 36px)" }}>
              Hi {customerFirstName}, I have a few questions
            </h1>
            <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-6 text-white/60">
              Send your answers here so I can keep your JDM search moving.
            </p>
          </section>

          <section className={`border p-5 transition sm:p-6 ${toneStyles[displayedStatusCopy.tone]}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${tagStyles[displayedStatusCopy.tone]}`}>
              {displayedStatusCopy.tag}
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-[1.9rem]">
              {displayedStatusCopy.heading}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base">{displayedStatusCopy.message}</p>
            {shouldShowReportCta && reportUrl ? (
              <a
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
                href={reportUrl}
              >
                View Your Custom Report →
              </a>
            ) : null}
          </section>

          {docket.status === "new" ? (
            <section className="border border-white/[0.08] bg-black p-5">
              <h2 className="text-xl font-semibold text-white">What I have from you</h2>
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

          {shouldRenderLatestMessageCard || answersSubmitted ? (
            <section className="border border-[#E55125]/45 bg-black p-5 shadow-[0_18px_60px_rgba(229,81,37,0.14)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Latest message from Adam</h2>
                {latestUnansweredQuestionTimestamp ? (
                  <time className="text-xs text-white/55" dateTime={latestUnansweredQuestionTimestamp}>
                    {formatMessageTimestamp(latestUnansweredQuestionTimestamp)}
                  </time>
                ) : null}
              </div>

              {answersSubmitted ? (
                <div className="mt-6 border border-[#E55125]/25 bg-[#E55125]/10 p-4">
                  <p className="text-sm font-semibold text-white">Thanks, we received your answers.</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Our team is reviewing what you sent and will follow up shortly.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {answerError ? <p className="text-sm text-red-400">{answerError}</p> : null}
                  <ol className="list-decimal space-y-6 pl-5 text-sm text-white/85">
                    {latestUnansweredQuestions.map((question) => (
                      <li key={question.id}>
                        <MarkdownMessage className="text-white/85" content={question.question_text} />
                        <label className="mt-3 block">
                          <span className="sr-only">Answer this question</span>
                          <textarea
                            className="min-h-[84px] w-full resize-y border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                            disabled={isSubmittingAnswers}
                            onChange={(event) => updateAnswer(question.id, event.target.value)}
                            placeholder="Type your answer here"
                            rows={3}
                            value={answers[question.id] ?? ""}
                          />
                        </label>
                      </li>
                    ))}
                  </ol>

                  <button
                    className="min-h-11 w-full bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isSubmittingAnswers}
                    onClick={submitAnswers}
                    type="button"
                  >
                    {isSubmittingAnswers ? "Submitting..." : "Submit Answer"}
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {answersSubmitted ? <AccountUpsellPanel registerUrl={accountRegisterUrl} /> : null}

          <section className="border border-white/[0.08] bg-black transition hover:border-[#E55125]/35">
            <button
              aria-controls="customer-conversation-content"
              aria-expanded={isConversationExpanded}
              className="block w-full cursor-pointer p-5 text-left focus:outline-none focus:ring-2 focus:ring-[#E55125]/40 sm:p-6"
              onClick={() => setIsConversationExpanded((current) => !current)}
              type="button"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-xl font-semibold text-white">Our Conversation</span>
                  <span className="mt-2 block text-sm leading-6 text-white/55">{conversationSummary}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#E55125]/35 bg-black/20">
                  <ChevronIcon isExpanded={isConversationExpanded} />
                </span>
              </span>
            </button>

            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                isConversationExpanded ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0"
              }`}
              id="customer-conversation-content"
            >
              <div className="border-t border-white/10 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                <CustomerCommunicationTimeline
                  customerQuestions={customerQuestions}
                  marcusQuestions={timelineMarcusQuestions}
                  perspective="customer"
                  readOnly={true}
                />
              </div>
            </div>
          </section>

          <section className="border border-white/[0.08] bg-black p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-white">Have a question for me?</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Send me a message and I will get back to you.
            </p>

            <div className="mt-5">
              <textarea
                className="min-h-28 w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                disabled={isSendingQuestion}
                onChange={(event) => setQuestionForTeam(event.target.value)}
                placeholder="Type your question or extra details for Adam"
                value={questionForTeam}
              />
            </div>

            {askError ? <p className="mt-4 text-sm text-red-400">{askError}</p> : null}
            {askSuccess ? <p className="mt-4 text-sm text-emerald-400">{askSuccess}</p> : null}

            <button
              className="mt-5 border border-[#E55125] px-5 py-3 text-sm font-semibold text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSendingQuestion}
              onClick={submitCustomerQuestion}
              type="button"
            >
              {isSendingQuestion ? "Sending..." : "Send My Question"}
            </button>
          </section>

          <footer className="pb-4 pt-2 text-center text-xs leading-6 text-white/45">
            <p>support@jdmrushimports.ca</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";

type Question = {
  id: string;
  question_text: string;
};

type CustomerQuestionsClientProps = {
  askEndpoint: string;
  customerName: string;
  submitEndpoint: string;
  unansweredQuestions: Question[];
};

export function CustomerQuestionsClient({
  askEndpoint,
  customerName,
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

  const hasUnansweredQuestions = unansweredQuestions.length > 0;
  const visibleName = customerName.trim() || "there";
  const firstName = customerName.trim().split(/\s+/)[0] || "there";

  const allAnswersFilled = useMemo(
    () =>
      unansweredQuestions.every((question) => {
        const answer = answers[question.id];
        return typeof answer === "string" && answer.trim().length > 0;
      }),
    [answers, unansweredQuestions]
  );

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function submitAnswers() {
    if (!hasUnansweredQuestions || answersSubmitted || isSubmittingAnswers) {
      return;
    }

    if (!allAnswersFilled) {
      setAnswerError("Please answer each question before submitting.");
      return;
    }

    setIsSubmittingAnswers(true);
    setAnswerError(null);

    try {
      const payload = unansweredQuestions.map((question) => ({
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
    <main className="min-h-screen bg-[#0d0d0d] px-5 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-[680px]">
        <div className="text-center">
          <div className="inline-flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="JDM Rush Imports"
              className="h-[50px] w-auto"
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
            />
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {answersSubmitted ? (
            <section className="rounded-lg border-l-4 border-[#E55125] bg-[#1a1a1a] p-6">
              <p className="text-sm leading-7 text-white/88">
                Your answers have been submitted! Our team in Japan is now on the hunt - searching auctions and private dealers to find your perfect match. We&apos;ll email you as soon as your personalized import report is ready. Your dream JDM is getting closer!
              </p>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
            <h1 className="text-3xl font-semibold text-white sm:text-[2.2rem]">
              A Few Quick Questions, {firstName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
              Hi {visibleName}, we need a bit more information before we can keep your docket moving.
              Please answer the questions below and send us anything else that would help.
            </p>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#141414] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Questions</h2>
              {hasUnansweredQuestions ? (
                <span className="text-sm text-white/45">{unansweredQuestions.length} pending</span>
              ) : null}
            </div>

            {hasUnansweredQuestions ? (
              <div className="mt-6 space-y-5">
                {answerError ? <p className="text-sm text-red-400">{answerError}</p> : null}
                {!answersSubmitted ? (
                  <>
                    {unansweredQuestions.map((question, index) => (
                      <label className="block" key={question.id}>
                        <span className="text-sm font-medium text-white/80">
                          {index + 1}. {question.question_text}
                        </span>
                        <textarea
                          className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                          disabled={answersSubmitted || isSubmittingAnswers}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          placeholder="Type your answer here"
                          value={answers[question.id] ?? ""}
                        />
                      </label>
                    ))}

                    <button
                      className="w-full rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={answersSubmitted || isSubmittingAnswers}
                      onClick={submitAnswers}
                      type="button"
                    >
                      {isSubmittingAnswers ? "Submitting..." : "Submit Answers"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-emerald-400">
                    Your answers are in. You can still use the section below if you want to ask us anything else.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4 text-sm text-emerald-300">
                There are no outstanding questions for your docket right now.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#141414] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Ask Us Anything</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              If there is anything you want to add or ask, send it here and our team will review it.
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
        </div>
      </div>
    </main>
  );
}

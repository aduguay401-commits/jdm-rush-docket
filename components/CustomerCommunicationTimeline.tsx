export type TimelineMarcusQuestion = {
  id: string;
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string | null;
};

export type TimelineCustomerQuestion = {
  id: string;
  question_text: string | null;
  answer_text?: string | null;
  created_at: string | null;
  read_at?: string | null;
};

type Props = {
  marcusQuestions: TimelineMarcusQuestion[];
  customerQuestions: TimelineCustomerQuestion[];
  readOnly?: boolean;
};

type CommunicationTimelineEntry =
  | {
      type: "AGENT_QUESTIONS";
      timestamp: string;
      questions: TimelineMarcusQuestion[];
    }
  | {
      type: "CUSTOMER_ANSWERS";
      timestamp: string;
      answers: TimelineMarcusQuestion[];
    }
  | {
      type: "CUSTOMER_QUESTION";
      timestamp: string | null;
      question: TimelineCustomerQuestion;
    };

function formatCommunicationTimestamp(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toLocaleString() : "Unknown time";
}

function buildCommunicationTimeline(
  marcusQuestions: TimelineMarcusQuestion[],
  customerQuestions: TimelineCustomerQuestion[]
) {
  const agentQuestionBatches = new Map<string, TimelineMarcusQuestion[]>();
  for (const question of marcusQuestions) {
    if (!question.created_at) {
      continue;
    }

    const batch = agentQuestionBatches.get(question.created_at) ?? [];
    batch.push(question);
    agentQuestionBatches.set(question.created_at, batch);
  }

  const customerAnswerBatches = new Map<string, TimelineMarcusQuestion[]>();
  for (const question of marcusQuestions) {
    if (!question.answered_at) {
      continue;
    }

    const batch = customerAnswerBatches.get(question.answered_at) ?? [];
    batch.push(question);
    customerAnswerBatches.set(question.answered_at, batch);
  }

  return [
    ...Array.from(agentQuestionBatches.entries()).map(
      ([timestamp, questionsForBatch]): CommunicationTimelineEntry => ({
        type: "AGENT_QUESTIONS",
        timestamp,
        questions: questionsForBatch,
      })
    ),
    ...Array.from(customerAnswerBatches.entries()).map(
      ([timestamp, answersForBatch]): CommunicationTimelineEntry => ({
        type: "CUSTOMER_ANSWERS",
        timestamp,
        answers: answersForBatch,
      })
    ),
    ...customerQuestions.map(
      (question): CommunicationTimelineEntry => ({
        type: "CUSTOMER_QUESTION",
        timestamp: question.created_at,
        question,
      })
    ),
  ].sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

    return leftTime - rightTime;
  });
}

export default function CustomerCommunicationTimeline({ marcusQuestions, customerQuestions, readOnly = true }: Props) {
  const communicationTimeline = buildCommunicationTimeline(marcusQuestions, customerQuestions);
  const unansweredQuestionsCount = Math.max(
    marcusQuestions.filter((question) => !question.answer_text?.trim()).length,
    0
  );

  if (communicationTimeline.length === 0) {
    return <p className="text-sm text-white/70">No customer communication yet.</p>;
  }

  return (
    <div className="space-y-3">
      {communicationTimeline.map((entry) => {
        if (entry.type === "AGENT_QUESTIONS") {
          return (
            <article
              className="rounded-lg border border-white/10 border-l-4 border-l-[#E55125] bg-black/25 p-4"
              key={`agent-questions-${entry.timestamp}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-sm font-medium text-white">
                  <span aria-hidden="true" className="mr-2">
                    📤
                  </span>
                  Agent sent {entry.questions.length} {entry.questions.length === 1 ? "question" : "questions"}
                </h3>
                <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                  {formatCommunicationTimestamp(entry.timestamp)}
                </time>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/85">
                {entry.questions.map((question) => (
                  <li key={question.id}>{question.question_text}</li>
                ))}
              </ol>
            </article>
          );
        }

        if (entry.type === "CUSTOMER_ANSWERS") {
          return (
            <article
              className="rounded-lg border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-4"
              key={`customer-answers-${entry.timestamp}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-sm font-medium text-white">
                  <span aria-hidden="true" className="mr-2">
                    📥
                  </span>
                  Customer answered
                </h3>
                <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                  {formatCommunicationTimestamp(entry.timestamp)}
                </time>
              </div>
              {entry.answers.length > 1 ? (
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#E55125]">
                  {entry.answers.map((answer) => (
                    <li key={answer.id}>{answer.answer_text || "No answer provided."}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-[#E55125]">
                  {entry.answers[0]?.answer_text || "No answer provided."}
                </p>
              )}
            </article>
          );
        }

        return (
          <article
            className={`rounded-lg border border-white/10 border-l-4 border-l-[#22c55e] bg-black/25 p-4 ${
              !readOnly && entry.question.read_at === null ? "border-l-[#E55125] bg-[#E55125]/5" : ""
            }`}
            key={`customer-question-${entry.question.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-white">
                <span aria-hidden="true" className="mr-2">
                  💬
                </span>
                Customer asked
              </h3>
              {entry.timestamp ? (
                <time className="text-xs text-white/60" dateTime={entry.timestamp}>
                  {formatCommunicationTimestamp(entry.timestamp)}
                </time>
              ) : (
                <span className="text-xs text-white/60">Unknown time</span>
              )}
            </div>
            <p className="mt-3 text-sm text-white/90">{entry.question.question_text}</p>
          </article>
        );
      })}

      {!readOnly && unansweredQuestionsCount > 0 ? (
        <article className="rounded-lg border border-white/10 border-l-4 border-l-white/20 bg-black/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-medium text-white/60">
              <span aria-hidden="true" className="mr-2">
                ⏳
              </span>
              Awaiting customer response
            </h3>
          </div>
        </article>
      ) : null}
    </div>
  );
}

export type CustomerHomeBaseTone = "active" | "waiting" | "closed";

export type CustomerHomeBaseStatusCopy = {
  tag: string;
  heading: string;
  message: string;
  showReportLink: boolean;
  showQuestionForm: boolean;
  tone: CustomerHomeBaseTone;
};

function withName(template: string, firstName: string) {
  return template.replace("[Name]", firstName);
}

export function getCustomerHomeBaseStatusCopy(
  status: string | null | undefined,
  firstName: string
): CustomerHomeBaseStatusCopy {
  const normalizedStatus = status ?? "new";
  const copyByStatus: Record<string, CustomerHomeBaseStatusCopy> = {
    new: {
      tag: "REQUEST RECEIVED",
      heading: "Welcome aboard, [Name]",
      message:
        "We're reviewing your request and will reach out shortly with any clarifying questions or your custom JDM report.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    questions_sent: {
      tag: "ACTION NEEDED",
      heading: "Answer a few quick questions",
      message: "We need a bit more information to find your perfect JDM. Please answer the questions below.",
      showReportLink: false,
      showQuestionForm: true,
      tone: "active",
    },
    answers_received: {
      tag: "WE GOT YOUR ANSWERS",
      heading: "We are on it",
      message: "Our team is reviewing what you sent and will follow up shortly.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    research_in_progress: {
      tag: "RESEARCH IN PROGRESS",
      heading: "We are hunting for your JDM",
      message:
        "Our team in Japan is researching options for you right now. Expect your custom report within a few days.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    report_sent: {
      tag: "YOUR REPORT IS READY",
      heading: "Review your custom options",
      message: "We found options just for you to consider. Take a look and choose your next step.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "active",
    },
    decision_made: {
      tag: "DECISION RECEIVED",
      heading: "Thanks for your decision",
      message: "Adam and the team will be in touch about next steps for your purchase.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "active",
    },
    cleared: {
      tag: "COMPLETE",
      heading: "Welcome to the JDM Rush family",
      message: "Your purchase is complete. We are so glad to have helped you bring home your JDM.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "closed",
    },
    paused: {
      tag: "PAUSED",
      heading: "Your search is paused",
      message: "No worries - we will pick this back up when you are ready. Feel free to send a message any time.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "waiting",
    },
    unresponsive: {
      tag: "STILL INTERESTED?",
      heading: "We have not heard from you",
      message: "It has been a while. Send us a message below and we will pick up right where we left off.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "waiting",
    },
    lost: {
      tag: "PROJECT CLOSED",
      heading: "This project is no longer active",
      message: "If you would like to start a new search, please visit jdmrushimports.ca/get-started.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "closed",
    },
  };

  const copy = copyByStatus[normalizedStatus] ?? copyByStatus.new;

  return {
    ...copy,
    heading: withName(copy.heading, firstName),
  };
}

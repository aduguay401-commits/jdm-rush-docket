export type CustomerHomeBaseTone = "active" | "waiting" | "closed";

export type CustomerHomeBaseStatusCopy = {
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
      heading: "Welcome to JDM Rush, [Name]!",
      message:
        "We have received your request and are reviewing it now. Our team will reach out shortly with any clarifying questions or your custom JDM report.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    questions_sent: {
      heading: "A few quick questions, [Name]",
      message: "We need a bit more information before we can keep your search moving. Please answer the questions below.",
      showReportLink: false,
      showQuestionForm: true,
      tone: "active",
    },
    answers_received: {
      heading: "Thanks for those answers, [Name]!",
      message: "Our team is reviewing what you sent and will follow up shortly.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    research_in_progress: {
      heading: "Research is underway",
      message:
        "Our team in Japan is researching options for you right now. We will email you the moment your custom report is ready - usually within a few days.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "active",
    },
    report_sent: {
      heading: "Your custom JDM report is ready!",
      message: "Review the options we found for you and choose your next step.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "active",
    },
    decision_made: {
      heading: "Decision received!",
      message: "Adam and the team will be in touch about next steps for your purchase.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "active",
    },
    cleared: {
      heading: "Welcome to the JDM Rush family!",
      message: "Your purchase is complete. We are so glad to have helped you bring home your JDM.",
      showReportLink: true,
      showQuestionForm: false,
      tone: "closed",
    },
    paused: {
      heading: "Your search is currently paused",
      message: "No worries - we will pick this back up when you are ready. Feel free to send us a message any time.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "waiting",
    },
    unresponsive: {
      heading: "Still interested?",
      message:
        "It has been a while since we heard from you. Just send us a message below and we will pick up right where we left off.",
      showReportLink: false,
      showQuestionForm: false,
      tone: "waiting",
    },
    lost: {
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

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

type AuctionListingForm = {
  lotTitle: string;
  specs: string;
  photos: string[];
};

type TransmissionType = "Manual" | "Auto";

type DealerOptionForm = {
  optionNumber: 1 | 2 | 3;
  expanded: boolean;
  year: string;
  make: string;
  model: string;
  grade: string;
  mileage: string;
  colour: string;
  transmission: TransmissionType;
  trim: string;
  dealerPriceJpy: string;
  photos: string[];
  salesSheetUrl: string;
  notes: string;
};

const MAX_QUESTIONS = 10;

const INITIAL_AUCTION_LISTING: AuctionListingForm = {
  lotTitle: "",
  specs: "",
  photos: [],
};

const INITIAL_DEALER_OPTIONS: DealerOptionForm[] = [
  {
    optionNumber: 1,
    expanded: true,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
  {
    optionNumber: 2,
    expanded: false,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
  {
    optionNumber: 3,
    expanded: false,
    year: "",
    make: "",
    model: "",
    grade: "",
    mileage: "",
    colour: "",
    transmission: "Manual",
    trim: "",
    dealerPriceJpy: "",
    photos: [],
    salesSheetUrl: "",
    notes: "",
  },
];

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

function cleanFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
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

  const [hammerPriceLowJpy, setHammerPriceLowJpy] = useState("");
  const [hammerPriceHighJpy, setHammerPriceHighJpy] = useState("");
  const [recommendedMaxBidJpy, setRecommendedMaxBidJpy] = useState("");
  const [salesHistoryNotes, setSalesHistoryNotes] = useState("");
  const [auctionListings, setAuctionListings] = useState<AuctionListingForm[]>([INITIAL_AUCTION_LISTING]);
  const [dealerOptions, setDealerOptions] = useState<DealerOptionForm[]>(INITIAL_DEALER_OPTIONS);
  const [overallNotes, setOverallNotes] = useState("");
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [submittingResearch, setSubmittingResearch] = useState(false);
  const [researchConfirmation, setResearchConfirmation] = useState<string | null>(null);
  const [researchLocked, setResearchLocked] = useState(false);

  const isResearchInProgress = docket?.status === "research_in_progress";
  const isAnswersReceived = docket?.status === "answers_received";
  const shouldShowResearchForm = isResearchInProgress || isAnswersReceived || researchLocked;
  const shouldHideQuestionsAndProceed = isResearchInProgress || isAnswersReceived || researchLocked;
  const isFormDisabled = submittingResearch || researchLocked;

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
    if (shouldHideQuestionsAndProceed) {
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
    if (shouldHideQuestionsAndProceed) {
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
    if (shouldHideQuestionsAndProceed || proceeding) {
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
    setProceedConfirmation("Confirmed. You can now complete and send the research report below.");
    setProceeding(false);
  }

  function updateAuctionListing(index: number, patch: Partial<AuctionListingForm>) {
    setAuctionListings((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addAuctionListing() {
    setAuctionListings((prev) => [...prev, { ...INITIAL_AUCTION_LISTING }]);
  }

  function removeAuctionListing(index: number) {
    setAuctionListings((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function updateDealerOption(optionNumber: number, patch: Partial<DealerOptionForm>) {
    setDealerOptions((prev) =>
      prev.map((item) => (item.optionNumber === optionNumber ? { ...item, ...patch } : item))
    );
  }

  async function uploadFiles({
    files,
    folder,
    fileType,
    target,
  }: {
    files: FileList;
    folder: string;
    fileType: "images" | "pdf";
    target: string;
  }) {
    if (files.length === 0) {
      return [] as string[];
    }

    setError(null);
    setUploadingTarget(target);

    const uploadedPaths: string[] = [];

    for (const file of Array.from(files)) {
      if (fileType === "images" && !file.type.startsWith("image/")) {
        setUploadingTarget(null);
        throw new Error("Only image files are allowed for photo uploads.");
      }

      if (fileType === "pdf" && file.type !== "application/pdf") {
        setUploadingTarget(null);
        throw new Error("Only PDF files are allowed for sales sheets.");
      }

      const storagePath = `${id}/${folder}/${crypto.randomUUID()}-${cleanFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("docket-files").upload(storagePath, file);

      if (uploadError) {
        setUploadingTarget(null);
        throw new Error(uploadError.message);
      }

      uploadedPaths.push(storagePath);
    }

    setUploadingTarget(null);
    return uploadedPaths;
  }

  async function handleAuctionListingPhotosUpload(index: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        folder: `auction-listings/listing-${index + 1}`,
        fileType: "images",
        target: `auction-listing-${index + 1}`,
      });

      updateAuctionListing(index, {
        photos: [...auctionListings[index].photos, ...uploaded],
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload listing photos.";
      setError(message);
    }
  }

  async function handleDealerOptionPhotosUpload(optionNumber: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    const currentOption = dealerOptions.find((option) => option.optionNumber === optionNumber);

    if (!currentOption) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        folder: `private-dealer/option-${optionNumber}/photos`,
        fileType: "images",
        target: `dealer-option-${optionNumber}-photos`,
      });

      updateDealerOption(optionNumber, {
        photos: [...currentOption.photos, ...uploaded],
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload dealer photos.";
      setError(message);
    }
  }

  async function handleDealerSalesSheetUpload(optionNumber: number, files: FileList | null) {
    if (!files || files.length === 0 || isFormDisabled) {
      return;
    }

    try {
      const uploaded = await uploadFiles({
        files,
        folder: `private-dealer/option-${optionNumber}/sales-sheet`,
        fileType: "pdf",
        target: `dealer-option-${optionNumber}-sales-sheet`,
      });

      if (uploaded.length > 0) {
        updateDealerOption(optionNumber, { salesSheetUrl: uploaded[0] });
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload sales sheet.";
      setError(message);
    }
  }

  function hasAnyDealerData(option: DealerOptionForm) {
    return [
      option.year,
      option.make,
      option.model,
      option.grade,
      option.mileage,
      option.colour,
      option.trim,
      option.dealerPriceJpy,
      option.notes,
      option.salesSheetUrl,
    ].some((value) => value.trim().length > 0) || option.photos.length > 0;
  }

  function validateResearchForm() {
    const validationErrors: string[] = [];
    const low = Number(hammerPriceLowJpy);
    const high = Number(hammerPriceHighJpy);
    const maxBid = Number(recommendedMaxBidJpy);

    if (!Number.isFinite(low) || low <= 0) {
      validationErrors.push("Hammer Price Low (JPY) is required and must be greater than 0.");
    }

    if (!Number.isFinite(high) || high <= 0) {
      validationErrors.push("Hammer Price High (JPY) is required and must be greater than 0.");
    }

    if (Number.isFinite(low) && Number.isFinite(high) && high < low) {
      validationErrors.push(
        "Hammer Price High (JPY) must be greater than or equal to Hammer Price Low (JPY)."
      );
    }

    if (!Number.isFinite(maxBid) || maxBid <= 0) {
      validationErrors.push("Recommended Max Bid (JPY) is required and must be greater than 0.");
    }

    for (let index = 0; index < auctionListings.length; index += 1) {
      const listing = auctionListings[index];

      if (!listing.lotTitle.trim() || !listing.specs.trim()) {
        validationErrors.push(`Auction Listing ${index + 1} requires Lot Title and Specs.`);
      }
    }

    const primaryOption = dealerOptions.find((option) => option.optionNumber === 1);

    if (!primaryOption || !primaryOption.year.trim() || !primaryOption.make.trim() || !primaryOption.model.trim()) {
      validationErrors.push("Private Dealer Option 1 requires Year, Make, and Model.");
    }

    if (
      !primaryOption ||
      !Number.isFinite(Number(primaryOption.dealerPriceJpy)) ||
      Number(primaryOption.dealerPriceJpy) <= 0
    ) {
      validationErrors.push("Private Dealer Option 1 requires a valid Dealer Price (JPY).");
    }

    for (const option of dealerOptions.filter((item) => item.optionNumber !== 1)) {
      if (!hasAnyDealerData(option)) {
        continue;
      }

      if (!option.year.trim() || !option.make.trim() || !option.model.trim()) {
        validationErrors.push(
          `Private Dealer Option ${option.optionNumber} must include Year, Make, and Model when used.`
        );
      }

      if (!Number.isFinite(Number(option.dealerPriceJpy)) || Number(option.dealerPriceJpy) <= 0) {
        validationErrors.push(
          `Private Dealer Option ${option.optionNumber} must include a valid Dealer Price (JPY) when used.`
        );
      }
    }

    if (!overallNotes.trim()) {
      validationErrors.push("Overall Notes are required before sending to the customer.");
    }

    return validationErrors;
  }

  async function submitResearchReport() {
    console.log("[Research Submit] START", {
      docketId: id,
      submittingResearch,
      researchLocked,
      at: new Date().toISOString(),
    });

    if (isFormDisabled) {
      console.log("[Research Submit] BLOCKED", {
        reason: researchLocked ? "research_locked" : "submit_in_progress",
      });
      return;
    }

    const validationErrors = validateResearchForm();

    if (validationErrors.length > 0) {
      const message = `Validation failed. Fix the following fields:\n${validationErrors
        .map((item) => `- ${item}`)
        .join("\n")}`;
      console.error("[Research Submit] VALIDATION_FAILED", { validationErrors });
      setError(message);
      return;
    }

    setError(null);
    setResearchConfirmation(null);
    setSubmittingResearch(true);

    const payload = {
      hammerPriceLowJpy: Number(hammerPriceLowJpy),
      hammerPriceHighJpy: Number(hammerPriceHighJpy),
      recommendedMaxBidJpy: Number(recommendedMaxBidJpy),
      salesHistoryNotes: salesHistoryNotes.trim(),
      auctionListings: auctionListings.map((listing) => ({
        lotTitle: listing.lotTitle.trim(),
        specs: listing.specs.trim(),
        photos: listing.photos,
      })),
      privateDealerOptions: dealerOptions
        .filter((option) => option.optionNumber === 1 || hasAnyDealerData(option))
        .map((option) => ({
          optionNumber: option.optionNumber,
          year: option.year.trim(),
          make: option.make.trim(),
          model: option.model.trim(),
          grade: option.grade.trim(),
          mileage: option.mileage.trim(),
          colour: option.colour.trim(),
          transmission: option.transmission,
          trim: option.trim.trim(),
          dealerPriceJpy: Number(option.dealerPriceJpy),
          photos: option.photos,
          salesSheetUrl: option.salesSheetUrl.trim(),
          notes: option.notes.trim(),
      })),
      overallNotes: overallNotes.trim(),
    };

    console.log("[Research Submit] PAYLOAD", payload);

    let result: { success?: boolean; error?: string; details?: unknown } | null = null;
    let response: Response;

    try {
      response = await fetch(`/api/agent/research/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Network request failed before reaching API.";
      console.error("[Research Submit] FETCH_FAILED", { requestError });
      setError(`Failed to submit research report: ${message}`);
      setSubmittingResearch(false);
      return;
    }

    try {
      result = (await response.json()) as { success?: boolean; error?: string; details?: unknown };
    } catch (parseError) {
      console.error("[Research Submit] RESPONSE_PARSE_FAILED", { parseError });
      setError(`Failed to submit research report: API returned an unreadable response (HTTP ${response.status}).`);
      setSubmittingResearch(false);
      return;
    }

    if (!response.ok || !result?.success) {
      const detailsText =
        result?.details !== undefined
          ? `\nDetails: ${
              typeof result.details === "string" ? result.details : JSON.stringify(result.details, null, 2)
            }`
          : "";
      const errorMessage = result?.error ?? "Failed to submit research report.";
      console.error("[Research Submit] API_FAILED", {
        status: response.status,
        result,
      });
      setError(`Failed to submit research report (HTTP ${response.status}): ${errorMessage}${detailsText}`);
      setSubmittingResearch(false);
      return;
    }

    setDocket((prev) => (prev ? { ...prev, status: "report_sent" } : prev));
    setResearchLocked(true);
    setResearchConfirmation("Research report sent successfully. The form is now locked.");
    setSubmittingResearch(false);
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b border-white/10 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-[#E55125]">JDM Rush</p>
          <h1 className="mt-2 text-3xl font-semibold">Docket Details</h1>
        </header>

        {loading ? <p className="text-white/75">Loading docket...</p> : null}
        {error ? <p className="whitespace-pre-line text-red-400">{error}</p> : null}
        {questionsConfirmation ? (
          <p className="whitespace-pre-line text-emerald-400">{questionsConfirmation}</p>
        ) : null}
        {researchConfirmation ? <p className="text-emerald-400">{researchConfirmation}</p> : null}

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

            {shouldShowResearchForm ? (
              <section className="space-y-6 rounded-xl border border-white/12 bg-[#171717] p-5">
                <h2 className="text-xl font-semibold">Marcus Research Input Form</h2>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Auction Sales History</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="text-sm text-white/85">
                      Hammer Price Low (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setHammerPriceLowJpy(event.target.value)}
                        placeholder="e.g. 1200000"
                        type="number"
                        value={hammerPriceLowJpy}
                      />
                    </label>
                    <label className="text-sm text-white/85">
                      Hammer Price High (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setHammerPriceHighJpy(event.target.value)}
                        placeholder="e.g. 1700000"
                        type="number"
                        value={hammerPriceHighJpy}
                      />
                    </label>
                    <label className="text-sm text-white/85">
                      Recommended Max Bid (JPY)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={isFormDisabled}
                        min={0}
                        onChange={(event) => setRecommendedMaxBidJpy(event.target.value)}
                        placeholder="e.g. 1600000"
                        type="number"
                        value={recommendedMaxBidJpy}
                      />
                    </label>
                  </div>
                  <label className="block text-sm text-white/85">
                    Sales History Notes
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                      disabled={isFormDisabled}
                      onChange={(event) => setSalesHistoryNotes(event.target.value)}
                      placeholder="Include previous sales and market behavior."
                      value={salesHistoryNotes}
                    />
                  </label>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-medium">Current Weekly Auction Listings</h3>
                    <button
                      className="rounded-lg border border-[#E55125] px-4 py-2 text-sm font-medium text-[#E55125] transition hover:bg-[#E55125] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isFormDisabled}
                      onClick={addAuctionListing}
                      type="button"
                    >
                      + Add Another Auction Lot
                    </button>
                  </div>

                  <div className="space-y-4">
                    {auctionListings.map((listing, listingIndex) => (
                      <div className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-4" key={`auction-listing-${listingIndex + 1}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white/90">Auction Listing {listingIndex + 1}</p>
                          {auctionListings.length > 1 ? (
                            <button
                              className="rounded-md border border-red-400/60 px-3 py-1 text-xs text-red-300 transition hover:bg-red-400/10"
                              disabled={isFormDisabled}
                              onClick={() => removeAuctionListing(listingIndex)}
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <label className="block text-sm text-white/85">
                          Lot Title
                          <input
                            className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                            disabled={isFormDisabled}
                            onChange={(event) => updateAuctionListing(listingIndex, { lotTitle: event.target.value })}
                            type="text"
                            value={listing.lotTitle}
                          />
                        </label>
                        <label className="block text-sm text-white/85">
                          Specs
                          <textarea
                            className="mt-1 min-h-24 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                            disabled={isFormDisabled}
                            onChange={(event) => updateAuctionListing(listingIndex, { specs: event.target.value })}
                            value={listing.specs}
                          />
                        </label>
                        <label className="block text-sm text-white/85">
                          Photos
                          <input
                            accept="image/*"
                            className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                            disabled={isFormDisabled || uploadingTarget === `auction-listing-${listingIndex + 1}`}
                            multiple
                            onChange={(event) => void handleAuctionListingPhotosUpload(listingIndex, event.target.files)}
                            type="file"
                          />
                        </label>
                        {listing.photos.length > 0 ? (
                          <p className="text-xs text-white/70">{listing.photos.length} photo file(s) uploaded.</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Private Dealer Options</h3>
                  <div className="space-y-3">
                    {dealerOptions.map((option) => (
                      <div className="rounded-lg border border-white/10 bg-black/25" key={`dealer-option-${option.optionNumber}`}>
                        <button
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/90"
                          disabled={isFormDisabled}
                          onClick={() =>
                            updateDealerOption(option.optionNumber, {
                              expanded: !option.expanded,
                            })
                          }
                          type="button"
                        >
                          <span>Option {option.optionNumber}</span>
                          <span>{option.expanded ? "Hide" : "Expand"}</span>
                        </button>

                        {option.expanded ? (
                          <div className="space-y-3 border-t border-white/10 px-4 py-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="text-sm text-white/85">
                                Year
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { year: event.target.value })}
                                  type="text"
                                  value={option.year}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Make
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { make: event.target.value })}
                                  type="text"
                                  value={option.make}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Model
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { model: event.target.value })}
                                  type="text"
                                  value={option.model}
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="text-sm text-white/85">
                                Grade
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { grade: event.target.value })}
                                  type="text"
                                  value={option.grade}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Mileage
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { mileage: event.target.value })}
                                  type="text"
                                  value={option.mileage}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Colour
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { colour: event.target.value })}
                                  type="text"
                                  value={option.colour}
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="text-sm text-white/85">
                                Transmission
                                <div className="mt-1 flex rounded-lg border border-white/20 bg-black/35 p-1">
                                  <button
                                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                                      option.transmission === "Manual"
                                        ? "bg-[#E55125] text-white"
                                        : "text-white/75 hover:bg-white/10"
                                    }`}
                                    disabled={isFormDisabled}
                                    onClick={() => updateDealerOption(option.optionNumber, { transmission: "Manual" })}
                                    type="button"
                                  >
                                    Manual
                                  </button>
                                  <button
                                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                                      option.transmission === "Auto"
                                        ? "bg-[#E55125] text-white"
                                        : "text-white/75 hover:bg-white/10"
                                    }`}
                                    disabled={isFormDisabled}
                                    onClick={() => updateDealerOption(option.optionNumber, { transmission: "Auto" })}
                                    type="button"
                                  >
                                    Auto
                                  </button>
                                </div>
                              </div>
                              <label className="text-sm text-white/85">
                                Trim
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  onChange={(event) => updateDealerOption(option.optionNumber, { trim: event.target.value })}
                                  type="text"
                                  value={option.trim}
                                />
                              </label>
                              <label className="text-sm text-white/85">
                                Dealer Price (JPY)
                                <input
                                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                  disabled={isFormDisabled}
                                  min={0}
                                  onChange={(event) =>
                                    updateDealerOption(option.optionNumber, { dealerPriceJpy: event.target.value })
                                  }
                                  type="number"
                                  value={option.dealerPriceJpy}
                                />
                              </label>
                            </div>

                            <label className="block text-sm text-white/85">
                              Photos
                              <input
                                accept="image/*"
                                className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                                disabled={isFormDisabled || uploadingTarget === `dealer-option-${option.optionNumber}-photos`}
                                multiple
                                onChange={(event) => void handleDealerOptionPhotosUpload(option.optionNumber, event.target.files)}
                                type="file"
                              />
                            </label>

                            <label className="block text-sm text-white/85">
                              Sales Sheet (PDF)
                              <input
                                accept="application/pdf"
                                className="mt-1 block w-full text-sm text-white/75 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                                disabled={isFormDisabled || uploadingTarget === `dealer-option-${option.optionNumber}-sales-sheet`}
                                onChange={(event) => void handleDealerSalesSheetUpload(option.optionNumber, event.target.files)}
                                type="file"
                              />
                            </label>

                            {option.photos.length > 0 ? (
                              <p className="text-xs text-white/70">{option.photos.length} photo file(s) uploaded.</p>
                            ) : null}
                            {option.salesSheetUrl ? (
                              <p className="text-xs text-white/70">Sales sheet uploaded: {option.salesSheetUrl}</p>
                            ) : null}

                            <label className="block text-sm text-white/85">
                              Notes
                              <textarea
                                className="mt-1 min-h-24 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                                disabled={isFormDisabled}
                                onChange={(event) => updateDealerOption(option.optionNumber, { notes: event.target.value })}
                                value={option.notes}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="text-lg font-medium">Your Recommendation</h3>
                  <label className="block text-sm text-white/85">
                    Overall Notes
                    <textarea
                      className="mt-1 min-h-32 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                      disabled={isFormDisabled}
                      onChange={(event) => setOverallNotes(event.target.value)}
                      value={overallNotes}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-4">
                  <button
                    className="rounded-lg bg-[#E55125] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isFormDisabled || uploadingTarget !== null}
                    onClick={submitResearchReport}
                    type="button"
                  >
                    {submittingResearch ? "Sending..." : "Send to Customer"}
                  </button>
                </div>
              </section>
            ) : null}

            {!shouldHideQuestionsAndProceed ? (
              <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
                <h2 className="mb-4 text-xl font-semibold">Questions for Customer</h2>
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <label className="block text-sm text-white/85" key={`question-${index + 1}`}>
                      Question {index + 1}
                      <input
                        className="mt-1 w-full rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-white outline-none transition focus:border-[#E55125]"
                        disabled={false}
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
                    disabled={questions.length >= MAX_QUESTIONS}
                    onClick={addQuestionField}
                    type="button"
                  >
                    + Add Question
                  </button>
                  <button
                    className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={savingQuestions}
                    onClick={sendQuestions}
                    type="button"
                  >
                    {savingQuestions ? "Sending..." : "Send Questions to Customer"}
                  </button>
                </div>
              </section>
            ) : null}

            {!shouldHideQuestionsAndProceed ? (
              <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
                <h2 className="mb-4 text-xl font-semibold">Proceed Without Questions</h2>
                <button
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={proceeding}
                  onClick={proceedWithoutQuestions}
                  type="button"
                >
                  {proceeding ? "Confirming..." : "I have all the information I need"}
                </button>
                {proceedConfirmation ? <p className="mt-3 text-sm text-emerald-400">{proceedConfirmation}</p> : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

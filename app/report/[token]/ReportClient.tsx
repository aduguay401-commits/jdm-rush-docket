"use client";

import { useEffect, useMemo, useState } from "react";
import type { UIEvent } from "react";

type FeeBreakdown = {
  vehiclePriceCAD?: number;
  exportAgentFeeCAD?: number;
  shippingInsuranceCAD?: number;
  importDutyCAD?: number;
  exciseTaxCAD?: number;
  gstCAD?: number;
  wwsTerminalFeeCAD?: number;
  brokerageFeeCAD?: number;
  networkFeeCAD?: number;
  financeAdminFeeCAD?: number;
  jdmRushFeeCAD?: number;
  inlandTransportCAD?: number;
  totalDeliveredCAD?: number;
  pstCAD?: number;
  pstProvince?: string;
  input?: { exchangeRate?: number };
  dealerPriceCAD?: number;
  vehicleValueCAD?: number;
  dutyCAD?: number;
  transportCostCAD?: number;
  pstRate?: number;
};

type AuctionListing = {
  lot_title?: string;
  specs?: string;
  auction_lot_link?: string | null;
  photos?: string[];
};

export type DocketReportRecord = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  budget_bracket: string | null;
  destination_city: string | null;
  destination_province: string | null;
  timeline: string | null;
  status: string | null;
  selected_path?: string | null;
  selected_private_dealer_option?: number | null;
  chosen_path?: string | null;
  chosen_dealer_index?: number | null;
  approved_at?: string | null;
  exchange_rate_at_report: number | null;
  exchange_rate_date: string | null;
};

export type AuctionResearchRecord = {
  hammer_price_low_jpy: number | null;
  hammer_price_high_jpy: number | null;
  recommended_max_bid_jpy: number | null;
  sales_history_notes: string | null;
  auction_listings: AuctionListing[] | null;
};

export type PrivateDealerOptionRecord = {
  option_number: number;
  year: string | null;
  make: string | null;
  model: string | null;
  grade: string | null;
  mileage: string | null;
  colour: string | null;
  transmission: string | null;
  trim: string | null;
  dealer_price_jpy: number | null;
  dealer_price_cad: number | null;
  photos: string[] | null;
  marcus_notes: string | null;
  calculated_fees: FeeBreakdown | null;
  total_delivered_cad: number | null;
};

export type AuctionEstimateRecord = {
  docket_id?: string | null;
  midpoint_hammer_jpy: number | null;
  midpoint_hammer_cad: number | null;
  calculated_fees: FeeBreakdown | null;
  total_delivered_cad: number | null;
  total_delivered_estimate_cad: number | null;
};

type ReportClientProps = {
  docket: DocketReportRecord;
  auctionResearch: AuctionResearchRecord | null;
  privateDealerOptions: PrivateDealerOptionRecord[];
  auctionEstimate: AuctionEstimateRecord | null;
  decisionEndpoint: string;
  questionEndpoint: string;
};

const CAD_FORMATTER = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const JPY_FORMATTER = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
const JPY_NUMBER_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

function formatCad(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }
  const absolute = CAD_FORMATTER.format(Math.abs(value));
  return value < 0 ? `-$${absolute}` : `$${absolute}`;
}

function formatJpy(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }
  return JPY_FORMATTER.format(value);
}

function formatJpyWithYenSign(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }
  return `¥${JPY_NUMBER_FORMATTER.format(value)}`;
}

function cityLabel(city: string | null | undefined) {
  if (!city) {
    return "your destination";
  }

  const [raw] = city.split("-");
  if (!raw) {
    return "your destination";
  }

  return raw
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function renderText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value : "N/A";
}

function hasDisplayNotes(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "n/a";
}

function hasPositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasFeeBreakdownData(breakdown: FeeBreakdown | null | undefined) {
  if (!breakdown) {
    return false;
  }

  return [
    breakdown.vehiclePriceCAD,
    breakdown.exportAgentFeeCAD,
    breakdown.shippingInsuranceCAD,
    breakdown.importDutyCAD,
    breakdown.exciseTaxCAD,
    breakdown.gstCAD,
    breakdown.wwsTerminalFeeCAD,
    breakdown.brokerageFeeCAD,
    breakdown.networkFeeCAD,
    breakdown.financeAdminFeeCAD,
    breakdown.jdmRushFeeCAD,
    breakdown.inlandTransportCAD,
    breakdown.totalDeliveredCAD,
    breakdown.dealerPriceCAD,
    breakdown.vehicleValueCAD,
    breakdown.dutyCAD,
    breakdown.transportCostCAD,
  ].some(hasPositiveNumber);
}

function hasAuctionListingData(listing: AuctionListing) {
  return (
    hasDisplayNotes(listing.lot_title) ||
    hasDisplayNotes(listing.specs) ||
    hasDisplayNotes(listing.auction_lot_link) ||
    (Array.isArray(listing.photos) && listing.photos.some((photo) => hasDisplayNotes(photo)))
  );
}

function hasAuctionSalesHistoryData(auctionResearch: AuctionResearchRecord | null) {
  return (
    !!auctionResearch &&
    (hasPositiveNumber(auctionResearch.hammer_price_low_jpy) ||
      hasPositiveNumber(auctionResearch.hammer_price_high_jpy) ||
      hasPositiveNumber(auctionResearch.recommended_max_bid_jpy) ||
      hasDisplayNotes(auctionResearch.sales_history_notes))
  );
}

function hasAuctionEstimateData(auctionEstimate: AuctionEstimateRecord | null) {
  return (
    !!auctionEstimate &&
    (hasPositiveNumber(auctionEstimate.midpoint_hammer_jpy) ||
      hasPositiveNumber(auctionEstimate.midpoint_hammer_cad) ||
      hasPositiveNumber(auctionEstimate.total_delivered_cad) ||
      hasPositiveNumber(auctionEstimate.total_delivered_estimate_cad) ||
      hasFeeBreakdownData(auctionEstimate.calculated_fees))
  );
}

function formatExchangeDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "latest available date";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "latest available date";
  }

  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function DealerPhotoGallery({
  optionNumber,
  photos,
  onOpenLightbox,
}: {
  optionNumber: number;
  photos: string[];
  onOpenLightbox: (photos: string[], index: number, label: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const label = `Dealer option ${optionNumber}`;

  function updateActivePhoto(event: UIEvent<HTMLDivElement>) {
    const container = event.currentTarget;
    const nextIndex = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1));
    setActiveIndex(Math.min(Math.max(nextIndex, 0), photos.length - 1));
  }

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="sm:hidden">
        <div
          className="-mx-5 flex snap-x snap-mandatory overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={updateActivePhoto}
        >
          {photos.map((photo, index) => (
            <div className="w-full shrink-0 snap-center pr-3 last:pr-0" key={`${photo}-${index}`}>
              <button
                aria-label={`Open ${label} photo ${index + 1}`}
                className="block w-full"
                onClick={() => onOpenLightbox(photos, index, label)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${label} photo ${index + 1}`}
                  className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover"
                  loading="lazy"
                  src={photo}
                />
              </button>
            </div>
          ))}
        </div>
        {photos.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2">
            {photos.map((photo, index) => (
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition ${
                  index === activeIndex ? "bg-[#E55125]" : "bg-white/25"
                }`}
                key={`dot-${photo}-${index}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="hidden grid-cols-3 gap-3 sm:grid">
        {photos.map((photo, index) => (
          <button
            aria-label={`Open ${label} photo ${index + 1}`}
            className="group block w-full overflow-hidden rounded-xl border border-white/10"
            key={`${photo}-${index}`}
            onClick={() => onOpenLightbox(photos, index, label)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${label} photo ${index + 1}`}
              className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              loading="lazy"
              src={photo}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function FeeBreakdownTable({
  breakdown,
  destination,
  networkFeeLabel,
  exchangeRateAtReport,
  exchangeRateDate,
}: {
  breakdown: FeeBreakdown | null;
  destination: string;
  networkFeeLabel: string;
  exchangeRateAtReport: number | null;
  exchangeRateDate: string | null;
}) {
  const rows = [
    [
      "Vehicle Price",
      breakdown?.vehiclePriceCAD ?? breakdown?.dealerPriceCAD ?? breakdown?.vehicleValueCAD,
    ],
    ["Export Agent Fee", breakdown?.exportAgentFeeCAD],
    ["Shipping & Marine Insurance", breakdown?.shippingInsuranceCAD],
    ["Import Duty", breakdown?.importDutyCAD ?? breakdown?.dutyCAD],
    ["Excise Tax", breakdown?.exciseTaxCAD],
    ["GST (5%)", breakdown?.gstCAD],
    ["WWS Terminal Fee", breakdown?.wwsTerminalFeeCAD],
    ["Brokerage Fee", breakdown?.brokerageFeeCAD],
    [networkFeeLabel, breakdown?.networkFeeCAD],
    ["Finance & Admin Fee", breakdown?.financeAdminFeeCAD],
    ["JDM Rush Import Fee", breakdown?.jdmRushFeeCAD],
    [`Delivery to ${destination}`, breakdown?.inlandTransportCAD ?? breakdown?.transportCostCAD],
    ["Total Delivered Price", breakdown?.totalDeliveredCAD],
  ] as const;

  const computedExchangeRate =
    typeof exchangeRateAtReport === "number"
      ? exchangeRateAtReport
      : breakdown?.input?.exchangeRate;
  const hasPstValue = typeof breakdown?.pstCAD === "number";
  const shouldShowPstLine = !hasPstValue || (breakdown?.pstCAD ?? 0) > 0;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
      <p className="mb-3 text-xs uppercase tracking-[0.15em] text-white/50">All amounts in CAD</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[14px] text-white/85 sm:text-sm">
          <tbody>
            {rows.map(([label, value], index) => {
              const isTotal = label === "Total Delivered Price";
              return (
                <tr className="border-b border-white/10 last:border-b-0" key={`${label}-${index}`}>
                  <td className={`py-2 pr-4 text-[14px] sm:text-sm ${isTotal ? "font-semibold text-white" : ""}`}>
                    {label}
                  </td>
                  <td
                    className={`py-2 text-right text-[14px] font-semibold sm:text-sm ${
                      isTotal ? "text-[#E55125]" : ""
                    }`}
                  >
                    {formatCad(value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shouldShowPstLine ? (
        <p className="mt-4 text-xs leading-5 text-white/55">
          PST is paid separately at registration in your province and is not included in the total.
          {hasPstValue
            ? ` Estimated PST${breakdown?.pstProvince ? ` (${breakdown.pstProvince})` : ""}: ${formatCad(
                breakdown.pstCAD
              )}${
                typeof breakdown?.pstRate === "number"
                  ? ` (${(breakdown.pstRate * 100).toFixed(2)}%)`
                  : ""
              }.`
            : ""}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-white/55">
        Exchange-rate disclaimer: CAD values are based on JPY/CAD rate
        {typeof computedExchangeRate === "number" ? ` ${computedExchangeRate.toFixed(4)}` : " used in report"}
        {exchangeRateDate ? ` on ${formatExchangeDate(exchangeRateDate)}` : ""}. Final billed amounts may vary.
      </p>
    </div>
  );
}

function SearchSummaryCard({ docket }: { docket: DocketReportRecord }) {
  const vehicle = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  const destination = [cityLabel(docket.destination_city), docket.destination_province]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ");

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
      <h2 className="text-lg font-semibold text-white">Search Summary</h2>
      <div className="mt-4 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
        <p>
          <span className="text-white/45">Vehicle:</span> {vehicle || "N/A"}
        </p>
        <p>
          <span className="text-white/45">Budget:</span> {renderText(docket.budget_bracket)}
        </p>
        <p>
          <span className="text-white/45">Destination:</span> {destination || "N/A"}
        </p>
        <p>
          <span className="text-white/45">Timeline:</span> {renderText(docket.timeline)}
        </p>
      </div>
    </div>
  );
}

export function ReportClient({
  docket,
  auctionResearch,
  privateDealerOptions,
  auctionEstimate,
  decisionEndpoint,
  questionEndpoint,
}: ReportClientProps) {
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [agreementUrl, setAgreementUrl] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<{
    path: "private_dealer" | "auction";
    optionNumber: 1 | 2 | 3 | null;
  } | null>(() => {
    const selectedPath =
      docket.chosen_path === "private_dealer" || docket.chosen_path === "auction"
        ? docket.chosen_path
        : docket.selected_path === "private_dealer" || docket.selected_path === "auction"
          ? docket.selected_path
          : null;

    const selectedOption =
      docket.chosen_dealer_index === 1 || docket.chosen_dealer_index === 2 || docket.chosen_dealer_index === 3
        ? docket.chosen_dealer_index
        : docket.selected_private_dealer_option === 1 ||
            docket.selected_private_dealer_option === 2 ||
            docket.selected_private_dealer_option === 3
          ? docket.selected_private_dealer_option
          : null;

    if (docket.status !== "decision_made") {
      return null;
    }

    if (selectedPath === "auction") {
      return { path: "auction", optionNumber: null };
    }

    if (selectedPath === "private_dealer" && selectedOption) {
      return {
        path: "private_dealer",
        optionNumber: selectedOption,
      };
    }

    return null;
  });

  const [questionText, setQuestionText] = useState("");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSuccess, setQuestionSuccess] = useState<string | null>(null);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    index: number;
    label: string;
  } | null>(null);

  const visibleName = useMemo(
    () => docket.customer_first_name?.trim() || "there",
    [docket.customer_first_name]
  );

  const hasDecision = decisionState !== null;
  const destination = cityLabel(docket.destination_city);
  const customerDisplayName =
    [docket.customer_first_name, docket.customer_last_name]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ") || "Customer";
  const customerDisplayEmail =
    typeof docket.customer_email === "string" && docket.customer_email.trim().length > 0
      ? docket.customer_email
      : "No email on file";

  async function submitDecision(path: "private_dealer" | "auction", optionNumber?: 1 | 2 | 3) {
    if (hasDecision || isDeciding) {
      return;
    }

    setIsDeciding(true);
    setDecisionError(null);

    const response = await fetch(decisionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, dealer_index: optionNumber }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string; agreementUrl?: string };

    if (response.status === 409) {
      setDecisionError("You've already submitted your approval...");
      setIsDeciding(false);
      return;
    }

    if (!response.ok || !result.success) {
      setDecisionError("Something went wrong. Please email support@jdmrushimports.ca");
      setIsDeciding(false);
      return;
    }

    setDecisionState({ path, optionNumber: optionNumber ?? null });
    setCustomerFirstName(docket.customer_first_name?.trim() || "there");
    setCustomerEmail(docket.customer_email?.trim() || "");
    setAgreementUrl(
      result.agreementUrl ??
        (path === "private_dealer"
          ? "https://forms.wix.com/r/7191838185536618530"
          : "https://forms.wix.com/r/7211765470112776777")
    );
    setVehicleDescription(
      [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ") || "your selected vehicle"
    );
    setApprovalConfirmed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsDeciding(false);
  }

  async function submitQuestion() {
    const trimmed = questionText.trim();

    if (!trimmed) {
      setQuestionError("Please write your question before sending.");
      return;
    }

    setIsSendingQuestion(true);
    setQuestionError(null);
    setQuestionSuccess(null);

    const response = await fetch(questionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ questionText: trimmed }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setQuestionError(result.error ?? "Unable to send your question.");
      setIsSendingQuestion(false);
      return;
    }

    setQuestionText("");
    setQuestionSuccess("Your question has been sent to the team.");
    setIsSendingQuestion(false);
  }

  const listings = Array.isArray(auctionResearch?.auction_listings)
    ? auctionResearch?.auction_listings.filter(hasAuctionListingData)
    : [];
  const hasAuctionSalesHistory = hasAuctionSalesHistoryData(auctionResearch);
  const hasAuctionListings = listings.length > 0;
  const hasAuctionEstimate = hasAuctionEstimateData(auctionEstimate);
  const hasAuctionOption = hasAuctionEstimate;

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightbox(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightbox((current) =>
          current
            ? {
                ...current,
                index: (current.index - 1 + current.photos.length) % current.photos.length,
              }
            : current
        );
      }

      if (event.key === "ArrowRight") {
        setLightbox((current) =>
          current
            ? {
                ...current,
                index: (current.index + 1) % current.photos.length,
              }
            : current
        );
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightbox]);

  function openLightbox(photos: string[], index: number, label: string) {
    setLightbox({ photos, index, label });
  }

  function showPreviousLightboxPhoto() {
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (current.index - 1 + current.photos.length) % current.photos.length,
          }
        : current
    );
  }

  function showNextLightboxPhoto() {
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (current.index + 1) % current.photos.length,
          }
        : current
    );
  }

  const confirmationSteps = [
    {
      number: 1,
      title: "Check your email",
      badge: "Action required",
      badgeTone: "action" as const,
      detail: `We've sent your next-step documents to ${customerEmail || "your email address"}. Please open them to begin.`,
    },
    {
      number: 2,
      title: "Sign Purchase Agreement",
      badge: "Action required",
      badgeTone: "action" as const,
      detail: "Complete your purchase agreement so we can officially start sourcing and shipping prep.",
    },
    {
      number: 3,
      title: "Submit $1,500 deposit",
      badge: "Action required",
      badgeTone: "action" as const,
      detail: "Submit your deposit to secure allocation and lock in your place in the import pipeline.",
    },
    {
      number: 4,
      title: "We get to work",
      badge: "We handle this",
      badgeTone: "handled" as const,
      detail: "Our team handles sourcing, inspections, export logistics, and the full import coordination process.",
    },
    {
      number: 5,
      title: "We keep you updated",
      badge: "We handle this",
      badgeTone: "handled" as const,
      detail: "You'll receive regular progress updates as milestones are completed through delivery.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-5 py-10 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="text-center">
          <div className="inline-flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="JDM Rush Imports"
              className="h-[50px] w-auto"
              src="https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png"
            />
          </div>
        </header>

        {approvalConfirmed ? (
          <section className="pt-12">
            <div className="mx-auto max-w-[760px] rounded-3xl border border-white/10 bg-[#141414] p-6 text-center sm:p-10">
              <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[#E55125] bg-[#1a1a1a]">
                <span className="text-3xl leading-none text-[#E55125]">✓</span>
              </div>

              <h1 className="mt-6 text-3xl font-semibold text-white sm:text-[2.35rem]">
                You&apos;re all set, {customerFirstName}!
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/80">
                Your approval for {vehicleDescription}{" "}has been received.
              </p>
              {customerEmail ? (
                <p className="mt-2 text-sm leading-6 text-white/70">
                  We&apos;ll send next-step documents to {customerEmail}.
                </p>
              ) : null}

              <div className="mt-8 rounded-[12px] bg-[#1a1a1a] p-8 text-left">
                <h2 className="text-sm font-semibold tracking-[0.22em] text-[#E55125]">WHAT HAPPENS NOW</h2>
                <div className="mt-6">
                  {confirmationSteps.map((step) => (
                    <article className="mb-6 flex items-start gap-4 last:mb-0" key={step.number}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E55125] text-sm font-semibold text-white">
                        {step.number}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{step.title}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              step.badgeTone === "action"
                                ? "bg-[#E55125]/20 text-[#ff9b7a]"
                                : "bg-[#323232] text-[#d1d1d1]"
                            }`}
                          >
                            {step.badge}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-[1.6] text-white/60">{step.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="mt-8 text-left">
                <h2 className="text-sm font-semibold tracking-[0.22em] text-[#E55125]">TAKE ACTION NOW</h2>
                <div className="mt-4 flex flex-col gap-4 md:flex-row">
                  <article className="flex-1 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 sm:p-6">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[#E55125]">STEP 1</p>
                    <h3 className="mt-3 text-xl font-semibold text-white">Sign Your Purchase Agreement</h3>
                    <p className="mt-3 text-sm leading-6 text-white/75">
                      Takes less than 2 minutes and unlocks sourcing + shipping prep right away.
                    </p>
                    <a
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#E55125] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#f06a40]"
                      href={agreementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sign Agreement →
                    </a>
                  </article>

                  <article className="flex-1 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 sm:p-6">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[#E55125]">STEP 2</p>
                    <h3 className="mt-3 text-xl font-semibold text-white">Submit Your Deposit</h3>
                    <p className="mt-3 text-sm leading-6 text-white/75">
                      $1,500 CAD total secures your vehicle and confirms your allocation in the pipeline.
                    </p>
                    <p className="mt-2 text-sm text-white/65">$500 non-refundable + $1,000 refundable</p>
                    <a
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                      href="https://www.jdmrushimports.ca/deposit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Submit Deposit →
                    </a>
                  </article>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/70">
                  Not ready right now? No problem — we&apos;ve sent everything to {customerEmail || "your email"} so
                  you can complete it anytime.
                </p>
              </div>

              <p className="mt-6 text-sm leading-6 text-white/75">
                Questions at any point? Reach us at{" "}
                <a className="text-[#E55125] underline-offset-4 hover:underline" href="mailto:support@jdmrushimports.ca">
                  support@jdmrushimports.ca
                </a>
                .
              </p>
              <p className="mt-6 text-sm text-white/75">Adam &amp; the JDM Rush Team</p>
            </div>
          </section>
        ) : null}

        {!approvalConfirmed && (
          <>
            <section className="pt-10">
              <h1 className="text-3xl font-semibold text-white sm:text-[2.35rem]">
                Your Custom JDM Report is Ready, {visibleName}
              </h1>
              <SearchSummaryCard docket={docket} />
              {hasDecision ? (
                <div className="mt-5 rounded-2xl border-l-4 border-[#E55125] bg-[#1a1a1a] p-5">
                  <p className="text-sm font-semibold text-emerald-400">
                    ✓ Approval received
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Thanks. We have your approval on file for {customerDisplayName} ({customerDisplayEmail}) and our
                    team is moving to the next steps.
                  </p>
                </div>
              ) : null}
              {decisionError ? <p className="mt-4 text-sm text-red-400">{decisionError}</p> : null}
            </section>

            {hasAuctionSalesHistory ? (
              <section className="border-t border-white/10 pt-10">
                <h2 className="text-[18px] font-semibold text-white sm:text-2xl">Auction Sales History</h2>
                <div className="mt-5 rounded-3xl border border-white/10 bg-[#141414] p-5 sm:p-7">
                  <p className="text-sm text-white/65">Hammer Price Range</p>
                  <p className="mt-1 text-lg text-white">
                    {formatJpy(auctionResearch?.hammer_price_low_jpy)} - {formatJpy(auctionResearch?.hammer_price_high_jpy)}
                  </p>

                  <p className="mt-5 text-sm text-white/65">Recommended Max Bid</p>
                  <p className="mt-1 text-xl font-semibold text-[#E55125]">
                    {formatJpy(auctionResearch?.recommended_max_bid_jpy)}
                  </p>

                  <p className="mt-5 text-sm text-white/65">Sales Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">
                    {renderText(auctionResearch?.sales_history_notes)}
                  </p>
                </div>
              </section>
            ) : null}

            {hasAuctionListings ? (
              <section className="border-t border-white/10 pt-10">
                <h2 className="text-[18px] font-semibold text-white sm:text-2xl">Current Weekly Auction Listings</h2>
                <div className="mt-5 space-y-4">
                  {listings.map((listing, index) => (
                    <article className="rounded-3xl border border-white/10 bg-[#141414] p-5 sm:p-7" key={`${index}-${listing.lot_title ?? "lot"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{renderText(listing.lot_title)}</h3>
                          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-white">{renderText(listing.specs)}</p>
                        </div>
                        {listing.auction_lot_link ? (
                          <a
                            className="text-sm font-medium text-[#E55125] underline-offset-4 hover:underline"
                            href={listing.auction_lot_link}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open lot details
                          </a>
                        ) : null}
                      </div>

                      {Array.isArray(listing.photos) && listing.photos.length > 0 ? (
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {listing.photos.map((photo, photoIndex) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={`${listing.lot_title ?? "Auction listing"} photo ${photoIndex + 1}`}
                              className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover"
                              key={`${photo}-${photoIndex}`}
                              loading="lazy"
                              src={photo}
                            />
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {hasAuctionOption ? (
              <section className="border-t border-white/10 pt-10">
                <h2 className="text-[18px] font-semibold text-white sm:text-2xl">Auction Option</h2>
                <div className="mt-5 rounded-3xl border border-white/10 bg-[#141414] p-5 sm:p-7">
                  <div className="grid gap-3 text-sm text-white/78 sm:grid-cols-2">
                    <p>
                      <span className="text-white/45">Hammer Range:</span>{" "}
                      {formatJpy(auctionResearch?.hammer_price_low_jpy)} - {formatJpy(auctionResearch?.hammer_price_high_jpy)}
                    </p>
                    <p className="sm:col-span-2 -mt-1 text-xs leading-5 text-white/55">
                      Estimated hammer price is based on the midpoint of the 3-month sales range (
                      {formatJpyWithYenSign(auctionResearch?.hammer_price_low_jpy)} +{" "}
                      {formatJpyWithYenSign(auctionResearch?.hammer_price_high_jpy)} ÷ 2). Final cost will vary based on
                      actual winning hammer price at auction.
                    </p>
                    <p>
                      <span className="text-white/45">Estimate Midpoint:</span> {formatJpy(auctionEstimate?.midpoint_hammer_jpy)}
                    </p>
                    <p>
                      <span className="text-white/45">Estimate Midpoint (CAD):</span> {formatCad(auctionEstimate?.midpoint_hammer_cad)}
                    </p>
                    <p>
                      <span className="text-white/45">Total Delivered Estimate:</span>{" "}
                      {formatCad(auctionEstimate?.total_delivered_estimate_cad)}
                    </p>
                  </div>

                  <FeeBreakdownTable
                    breakdown={auctionEstimate?.calculated_fees ?? null}
                    destination={destination}
                    exchangeRateAtReport={docket.exchange_rate_at_report}
                    exchangeRateDate={docket.exchange_rate_date}
                    networkFeeLabel="JPY Auction Fee"
                  />

                  <p className="mt-4 text-xs leading-5 text-white/55">
                    Auction pricing is an estimate and final landed cost can change based on the final hammer result,
                    exchange movement, and auction-side conditions.
                  </p>

                  {!hasDecision ? (
                    <button
                      className="mt-5 w-full rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isDeciding}
                      onClick={() => submitDecision("auction")}
                      type="button"
                    >
                      {isDeciding ? "Saving your choice..." : "Approve for Purchase — Auction"}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="border-t border-white/10 pt-10">
              <h2 className="text-[18px] font-semibold text-white sm:text-2xl">Private Dealer Options</h2>
              {privateDealerOptions.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#141414] p-5 text-sm text-white/65">
                  No private dealer options were included in this report.
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {privateDealerOptions.map((option) => (
                    <article className="rounded-3xl border border-white/10 bg-[#141414] p-5 sm:p-7" key={option.option_number}>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          Option {option.option_number} —{" "}
                          {[option.year, option.make, option.model]
                            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                            .join(" ") || "N/A"}
                        </h3>
                      </div>

                      {Array.isArray(option.photos) && option.photos.length > 0 ? (
                        <DealerPhotoGallery
                          onOpenLightbox={openLightbox}
                          optionNumber={option.option_number}
                          photos={option.photos}
                        />
                      ) : null}

                      <div className="mt-5 grid gap-2 text-sm text-white/78 sm:grid-cols-2">
                        <p>
                          <span className="text-white/45">Vehicle:</span>{" "}
                          {[option.year, option.make, option.model].filter(Boolean).join(" ") || "N/A"}
                        </p>
                        <p>
                          <span className="text-white/45">Grade:</span> {renderText(option.grade)}
                        </p>
                        <p>
                          <span className="text-white/45">Mileage:</span> {renderText(option.mileage)}
                        </p>
                        <p>
                          <span className="text-white/45">Colour:</span> {renderText(option.colour)}
                        </p>
                        <p>
                          <span className="text-white/45">Transmission:</span> {renderText(option.transmission)}
                        </p>
                        <p>
                          <span className="text-white/45">Trim:</span> {renderText(option.trim)}
                        </p>
                        <p>
                          <span className="text-white/45">Dealer Price (JPY):</span> {formatJpy(option.dealer_price_jpy)}
                        </p>
                        <p>
                          <span className="text-white/45">Dealer Price (CAD):</span> {formatCad(option.dealer_price_cad)}
                        </p>
                      </div>

                      {hasDisplayNotes(option.marcus_notes) ? (
                        <>
                          <p className="mt-5 text-sm text-white/65">Marcus Notes</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">
                            {option.marcus_notes?.trim()}
                          </p>
                        </>
                      ) : null}

                      <FeeBreakdownTable
                        breakdown={option.calculated_fees}
                        destination={destination}
                        exchangeRateAtReport={docket.exchange_rate_at_report}
                        exchangeRateDate={docket.exchange_rate_date}
                        networkFeeLabel="Inter-dealer Network Fee"
                      />

                      {!hasDecision ? (
                        <button
                          className="mt-5 w-full rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={isDeciding}
                          onClick={() =>
                            submitDecision(
                              "private_dealer",
                              option.option_number as 1 | 2 | 3
                            )
                          }
                          type="button"
                        >
                          {isDeciding
                            ? "Saving your choice..."
                            : "Approve for Purchase — Private Dealer"}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="border-t border-white/10 pt-10">
              <h2 className="text-[18px] font-semibold text-white sm:text-2xl">Ask Us Anything</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Questions about these options, timelines, or next steps? Send us a note and we will respond quickly.
              </p>

              <div className="mt-5">
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#E55125] focus:ring-2 focus:ring-[#E55125]/20"
                  disabled={isSendingQuestion}
                  onChange={(event) => setQuestionText(event.target.value)}
                  placeholder="Type your question"
                  value={questionText}
                />
              </div>

              {questionError ? <p className="mt-4 text-sm text-red-400">{questionError}</p> : null}
              {questionSuccess ? <p className="mt-4 text-sm text-emerald-400">{questionSuccess}</p> : null}

              <button
                className="mt-5 rounded-2xl bg-[#E55125] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSendingQuestion}
                onClick={submitQuestion}
                type="button"
              >
                {isSendingQuestion ? "Sending..." : "Send My Question"}
              </button>
            </section>
          </>
        )}
      </div>

      {lightbox ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
        >
          <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
            <button
              aria-label="Close photo viewer"
              className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-2xl leading-none text-white transition hover:bg-white hover:text-black"
              onClick={() => setLightbox(null)}
              type="button"
            >
              ×
            </button>

            {lightbox.photos.length > 1 ? (
              <button
                aria-label="Previous photo"
                className="absolute left-0 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/70 text-3xl leading-none text-white transition hover:bg-white hover:text-black"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousLightboxPhoto();
                }}
                type="button"
              >
                ‹
              </button>
            ) : null}

            <div className="flex max-h-full max-w-full flex-col items-center" onClick={(event) => event.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${lightbox.label} photo ${lightbox.index + 1}`}
                className="max-h-[82vh] max-w-full rounded-xl border border-white/10 object-contain shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
                src={lightbox.photos[lightbox.index]}
              />
              {lightbox.photos.length > 1 ? (
                <p className="mt-4 text-sm text-white/70">
                  {lightbox.index + 1} / {lightbox.photos.length}
                </p>
              ) : null}
            </div>

            {lightbox.photos.length > 1 ? (
              <button
                aria-label="Next photo"
                className="absolute right-0 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/70 text-3xl leading-none text-white transition hover:bg-white hover:text-black"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextLightboxPhoto();
                }}
                type="button"
              >
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

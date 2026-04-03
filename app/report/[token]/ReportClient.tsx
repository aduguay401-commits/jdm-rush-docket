"use client";

import { useMemo, useState } from "react";

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
  selected_path: string | null;
  selected_private_dealer_option: number | null;
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
        <table className="w-full min-w-[520px] border-collapse text-left text-sm text-white/85">
          <tbody>
            {rows.map(([label, value], index) => {
              const isTotal = label === "Total Delivered Price";
              return (
                <tr className="border-b border-white/10 last:border-b-0" key={`${label}-${index}`}>
                  <td className={`py-2 pr-4 ${isTotal ? "font-semibold text-white" : ""}`}>{label}</td>
                  <td className={`py-2 text-right ${isTotal ? "font-semibold text-[#E55125]" : ""}`}>
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
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<{
    path: "private_dealer" | "auction";
    optionNumber: 1 | 2 | 3 | null;
  } | null>(() => {
    if (docket.status !== "decision_made") {
      return null;
    }

    if (docket.selected_path === "auction") {
      return { path: "auction", optionNumber: null };
    }

    if (
      docket.selected_path === "private_dealer" &&
      (docket.selected_private_dealer_option === 1 ||
        docket.selected_private_dealer_option === 2 ||
        docket.selected_private_dealer_option === 3)
    ) {
      return {
        path: "private_dealer",
        optionNumber: docket.selected_private_dealer_option,
      };
    }

    return null;
  });

  const [questionText, setQuestionText] = useState("");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSuccess, setQuestionSuccess] = useState<string | null>(null);
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);

  const visibleName = useMemo(
    () => docket.customer_first_name?.trim() || "there",
    [docket.customer_first_name]
  );

  const hasDecision = decisionState !== null;
  const destination = cityLabel(docket.destination_city);
  const decisionSuccessMessage = hasDecision
    ? "✅ Great choice! We’ve received your selection and our team will proceed with the next steps."
    : null;

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
      body: JSON.stringify({ path, optionNumber }),
    });

    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setDecisionError(result.error ?? "Failed to save your selection.");
      setIsDeciding(false);
      return;
    }

    setDecisionState({ path, optionNumber: optionNumber ?? null });
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
    ? auctionResearch?.auction_listings
    : [];

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-5 py-10 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="text-center">
          <div className="inline-flex flex-col items-center">
            <div className="text-4xl font-semibold tracking-[0.24em] sm:text-5xl">
              <span className="text-[#E55125]">JDM</span>
              <span className="ml-3 text-white">RUSH</span>
            </div>
            <p className="mt-2 text-xs tracking-[0.5em] text-white/45 sm:text-sm">IMPORTS</p>
          </div>
        </header>

        <section className="pt-10">
          <h1 className="text-3xl font-semibold text-white sm:text-[2.35rem]">
            Your Custom JDM Report is Ready, {visibleName}
          </h1>
          <SearchSummaryCard docket={docket} />
          {decisionSuccessMessage ? (
            <p className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {decisionSuccessMessage}
            </p>
          ) : null}
          {decisionError ? <p className="mt-4 text-sm text-red-400">{decisionError}</p> : null}
        </section>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold text-white">Auction Sales History</h2>
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

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold text-white">Current Weekly Auction Listings</h2>
          {listings.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#141414] p-5 text-sm text-white/65">
              No weekly listings were included in this report.
            </div>
          ) : (
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
          )}
        </section>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold text-white">Auction Option</h2>
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

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold text-white">Private Dealer Options</h2>
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
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {option.photos.map((photo, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`Dealer option ${option.option_number} photo ${index + 1}`}
                          className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover"
                          key={`${photo}-${index}`}
                          loading="lazy"
                          src={photo}
                        />
                      ))}
                    </div>
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
          <h2 className="text-2xl font-semibold text-white">Ask Us Anything</h2>
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
      </div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReportClient } from "../../../../report/[token]/ReportClient";
import type {
  AuctionEstimateRecord,
  AuctionResearchRecord,
  DocketReportRecord,
  PrivateDealerOptionRecord,
} from "../../../../report/[token]/ReportClient";

export type ResearchSubmitPayload = {
  hammerPriceLowJpy?: number;
  hammerPriceHighJpy?: number;
  recommendedMaxBidJpy?: number;
  salesHistoryNotes?: string;
  auctionListings?: Array<{ lotTitle: string; specs: string; photos: string[] }>;
  privateDealerOptions?: Array<{
    optionNumber: number;
    year: string;
    make: string;
    model: string;
    grade: string;
    mileage: string;
    colour: string;
    transmission: "Manual" | "Auto";
    trim: string;
    dealerPriceJpy: number;
    photos: string[];
    salesSheetUrl: string;
    notes: string;
  }>;
  overallNotes: string;
};

type PreviewClientProps = {
  docket: DocketReportRecord;
  auctionResearch: AuctionResearchRecord | null;
  privateDealerOptions: PrivateDealerOptionRecord[];
  auctionEstimate: AuctionEstimateRecord | null;
  submitPayload: ResearchSubmitPayload;
};

function getCustomerName(docket: DocketReportRecord) {
  return [docket.customer_first_name, docket.customer_last_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ") || "this customer";
}

export default function PreviewClient({
  docket,
  auctionResearch,
  privateDealerOptions,
  auctionEstimate,
  submitPayload,
}: PreviewClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editUrl = `/agent/docket/${docket.id}`;

  async function sendToCustomer() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/agent/research/${docket.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitPayload),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        setError(result.error ?? "Unable to send the report. Go back to edit or try again.");
        setSubmitting(false);
        return;
      }

      window.sessionStorage.setItem("dashboard_needs_refresh", "true");
      router.push("/agent/dashboard");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the report.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#101010]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/35 hover:bg-white/5 hover:text-white"
              onClick={() => router.push(editUrl)}
              type="button"
            >
              ← Back
              <span className="hidden sm:inline">&nbsp;to Edit</span>
            </button>
            <p className="hidden text-center text-sm text-white/55 sm:block">
              Preview — this is what {getCustomerName(docket)} will see
            </p>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#E55125] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting}
              onClick={() => void sendToCustomer()}
              type="button"
            >
              {submitting ? "Sending..." : "Send"}
              <span className="hidden sm:inline">&nbsp;to Customer</span>
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-white/55 sm:hidden">
            Preview for {getCustomerName(docket)}
          </p>
        </div>
        {error ? (
          <div className="mx-auto mt-3 max-w-6xl rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="border-b border-[#E55125]/25 bg-[#E55125]/10 px-4 py-3 text-center text-sm text-[#ffb39c] sm:px-6">
        📋 Preview Mode — Review the report below as the customer will see it. Click Send to Customer when ready.
      </div>

      <ReportClient
        auctionEstimate={auctionEstimate}
        auctionResearch={auctionResearch}
        decisionEndpoint="#"
        docket={docket}
        previewMode
        privateDealerOptions={privateDealerOptions}
        questionEndpoint="#"
      />
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PreviewClient from "./PreviewClient";
import type { ResearchSubmitPayload } from "./PreviewClient";
import type {
  AuctionEstimateRecord,
  AuctionResearchRecord,
  DocketReportRecord,
  PrivateDealerOptionRecord,
} from "../../../../report/[token]/ReportClient";

import { getCurrentUserRole } from "@/lib/admin/auth";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import {
  calculateImportCost,
  normalizeDestinationCity,
  type DutyType,
  type VehicleType,
} from "@/lib/importCalculator";
import { createServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type AuctionListingDraft = {
  lotTitle?: string;
  specs?: string;
  photos?: string[];
};

type DealerOptionDraft = {
  optionNumber?: number;
  year?: string;
  make?: string;
  model?: string;
  grade?: string;
  mileage?: string;
  colour?: string;
  transmission?: "Manual" | "Auto";
  trim?: string;
  dealerPriceJpy?: string | number;
  dealerPriceCad?: string | number;
  photos?: string[];
  salesSheetUrl?: string;
  notes?: string;
};

type ResearchDraft = {
  hammerPriceLowJpy?: string | number;
  hammerPriceHighJpy?: string | number;
  recommendedMaxBidJpy?: string | number;
  salesHistoryNotes?: string;
  overallNotes?: string;
  auctionListings?: AuctionListingDraft[];
  dealerOptions?: DealerOptionDraft[];
  sectionExpanded?: {
    auction?: boolean;
    dealer?: boolean;
  };
};

type PreviewDocket = DocketReportRecord & {
  research_draft: unknown;
  vehicle_type: string | null;
  duty_type: string | null;
};

function toDraftString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function toPositiveNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeDraft(value: unknown): ResearchDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const draft = value as ResearchDraft;

  return {
    hammerPriceLowJpy: toDraftString(draft.hammerPriceLowJpy),
    hammerPriceHighJpy: toDraftString(draft.hammerPriceHighJpy),
    recommendedMaxBidJpy: toDraftString(draft.recommendedMaxBidJpy),
    salesHistoryNotes: toDraftString(draft.salesHistoryNotes),
    overallNotes: toDraftString(draft.overallNotes),
    auctionListings: Array.isArray(draft.auctionListings)
      ? draft.auctionListings.map((listing) => ({
          lotTitle: toDraftString(listing?.lotTitle),
          specs: toDraftString(listing?.specs),
          photos: normalizeStringArray(listing?.photos),
        }))
      : [],
    dealerOptions: Array.isArray(draft.dealerOptions)
      ? draft.dealerOptions.map((option) => ({
          optionNumber: typeof option?.optionNumber === "number" ? option.optionNumber : undefined,
          year: toDraftString(option?.year),
          make: toDraftString(option?.make),
          model: toDraftString(option?.model),
          grade: toDraftString(option?.grade),
          mileage: toDraftString(option?.mileage),
          colour: toDraftString(option?.colour),
          transmission: option?.transmission === "Auto" ? "Auto" : "Manual",
          trim: toDraftString(option?.trim),
          dealerPriceJpy: toDraftString(option?.dealerPriceJpy),
          dealerPriceCad: toDraftString(option?.dealerPriceCad),
          photos: normalizeStringArray(option?.photos),
          salesSheetUrl: toDraftString(option?.salesSheetUrl),
          notes: toDraftString(option?.notes),
        }))
      : [],
    sectionExpanded:
      draft.sectionExpanded && typeof draft.sectionExpanded === "object"
        ? {
            auction: draft.sectionExpanded.auction === true,
            dealer: draft.sectionExpanded.dealer === true,
          }
        : undefined,
  };
}

function hasAuctionListingData(listing: AuctionListingDraft) {
  return (
    toDraftString(listing.lotTitle).trim().length > 0 ||
    toDraftString(listing.specs).trim().length > 0 ||
    normalizeStringArray(listing.photos).length > 0
  );
}

function hasAuctionMeaningfulData(draft: ResearchDraft) {
  const hasListingData = (draft.auctionListings ?? []).some(hasAuctionListingData);
  const hasPositiveAuctionPrice = [
    draft.hammerPriceLowJpy,
    draft.hammerPriceHighJpy,
    draft.recommendedMaxBidJpy,
  ].some((value) => toPositiveNumber(value) !== null);

  return hasListingData || (draft.sectionExpanded?.auction === true && hasPositiveAuctionPrice);
}

function hasDealerOptionData(option: DealerOptionDraft) {
  return [
    option.year,
    option.make,
    option.model,
    option.grade,
    option.mileage,
    option.colour,
    option.trim,
    option.dealerPriceJpy,
    option.dealerPriceCad,
    option.salesSheetUrl,
    option.notes,
  ].some((value) => toDraftString(value).trim().length > 0) || normalizeStringArray(option.photos).length > 0;
}

function hasDealerMeaningfulData(draft: ResearchDraft) {
  return (draft.dealerOptions ?? []).some(hasDealerOptionData);
}

function isVehicleType(value: string): value is VehicleType {
  return value === "regular" || value === "suv";
}

function isDutyType(value: string): value is DutyType {
  return value === "duty-free" || value === "full-duty";
}

function extractStoragePath(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const marker = "/docket-files/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      }
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("docket-files/")) {
    return trimmed.slice("docket-files/".length);
  }

  return trimmed.replace(/^\/+/, "");
}

async function createSignedFileUrl(
  supabase: ReturnType<typeof createServerClient>,
  filePath: string
): Promise<string> {
  const storagePath = extractStoragePath(filePath);
  if (!storagePath) {
    return filePath;
  }

  const { data, error } = await supabase.storage.from("docket-files").createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return filePath;
  }

  return data.signedUrl;
}

function buildSubmitPayload(draft: ResearchDraft): ResearchSubmitPayload {
  const auctionHasData = hasAuctionMeaningfulData(draft);
  const dealerHasData = hasDealerMeaningfulData(draft);
  const payload: ResearchSubmitPayload = {
    overallNotes: toDraftString(draft.overallNotes).trim(),
  };

  if (auctionHasData) {
    payload.hammerPriceLowJpy = toPositiveNumber(draft.hammerPriceLowJpy) ?? 0;
    payload.hammerPriceHighJpy = toPositiveNumber(draft.hammerPriceHighJpy) ?? 0;
    payload.recommendedMaxBidJpy = toPositiveNumber(draft.recommendedMaxBidJpy) ?? 0;
    payload.salesHistoryNotes = toDraftString(draft.salesHistoryNotes).trim();
    payload.auctionListings = (draft.auctionListings ?? [])
      .filter(hasAuctionListingData)
      .map((listing) => ({
        lotTitle: toDraftString(listing.lotTitle).trim(),
        specs: toDraftString(listing.specs).trim(),
        photos: normalizeStringArray(listing.photos),
      }));
  }

  if (dealerHasData) {
    payload.privateDealerOptions = (draft.dealerOptions ?? [])
      .filter(hasDealerOptionData)
      .map((option) => ({
        optionNumber: option.optionNumber ?? 1,
        year: toDraftString(option.year).trim(),
        make: toDraftString(option.make).trim(),
        model: toDraftString(option.model).trim(),
        grade: toDraftString(option.grade).trim(),
        mileage: toDraftString(option.mileage).trim(),
        colour: toDraftString(option.colour).trim(),
        transmission: option.transmission === "Auto" ? "Auto" : "Manual",
        trim: toDraftString(option.trim).trim(),
        dealerPriceJpy: toPositiveNumber(option.dealerPriceJpy) ?? 0,
        photos: normalizeStringArray(option.photos),
        salesSheetUrl: toDraftString(option.salesSheetUrl).trim(),
        notes: toDraftString(option.notes).trim(),
      }));
  }

  return payload;
}

function validatePreviewPayload(payload: ResearchSubmitPayload) {
  const errors: string[] = [];

  if (!payload.overallNotes.trim()) {
    errors.push("Overall Notes are required before previewing.");
  }

  if (payload.auctionListings) {
    if (!payload.hammerPriceLowJpy || !payload.hammerPriceHighJpy || !payload.recommendedMaxBidJpy) {
      errors.push("Auction preview requires hammer low, hammer high, and recommended max bid.");
    }

    if (payload.hammerPriceLowJpy && payload.hammerPriceHighJpy && payload.hammerPriceHighJpy < payload.hammerPriceLowJpy) {
      errors.push("Hammer Price High must be greater than or equal to Hammer Price Low.");
    }

    if (payload.auctionListings.length === 0) {
      errors.push("Auction preview requires at least one auction listing.");
    }

    for (const [index, listing] of payload.auctionListings.entries()) {
      if (!listing.lotTitle || !listing.specs) {
        errors.push(`Auction Listing ${index + 1} requires Lot Title and Specs.`);
      }
    }
  }

  if (payload.privateDealerOptions) {
    for (const option of payload.privateDealerOptions) {
      if (!option.year || !option.make || !option.model) {
        errors.push(`Private Dealer Option ${option.optionNumber} must include Year, Make, and Model.`);
      }

      if (!option.dealerPriceJpy) {
        errors.push(`Private Dealer Option ${option.optionNumber} must include a valid Dealer Price (JPY).`);
      }
    }
  }

  if (!payload.auctionListings && !payload.privateDealerOptions) {
    errors.push("Add at least one auction lot or dealer option before previewing.");
  }

  return errors;
}

function ErrorState({ docketId, message }: { docketId: string; message: string }) {
  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-6">
        <h1 className="text-xl font-semibold">Preview unavailable</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-red-100">{message}</p>
        <Link
          className="mt-5 inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/75 transition hover:border-[#E55125] hover:text-white"
          href={`/agent/docket/${docketId}`}
        >
          ← Back to Edit
        </Link>
      </div>
    </main>
  );
}

export default async function AgentReportPreviewPage({ params }: PageProps) {
  const { user, role } = await getCurrentUserRole();

  if (!user || (role !== "agent" && role !== "admin")) {
    redirect("/agent/login");
  }

  const { id } = await params;
  const supabase = createServerClient();
  const { data: docket, error } = await supabase
    .from("dockets")
    .select("*")
    .eq("id", id)
    .maybeSingle<PreviewDocket>();

  if (error) {
    throw new Error(error.message);
  }

  if (!docket) {
    notFound();
  }

  const draft = normalizeDraft(docket.research_draft);

  if (!draft || (!hasAuctionMeaningfulData(draft) && !hasDealerMeaningfulData(draft))) {
    redirect(`/agent/docket/${id}`);
  }

  const submitPayload = buildSubmitPayload(draft);
  const validationErrors = validatePreviewPayload(submitPayload);
  if (validationErrors.length > 0) {
    return <ErrorState docketId={id} message={validationErrors.map((item) => `- ${item}`).join("\n")} />;
  }

  const destinationCity = docket.destination_city ? normalizeDestinationCity(docket.destination_city) : null;
  if (!destinationCity) {
    return <ErrorState docketId={id} message="Docket destination city is missing or invalid for fee calculation." />;
  }

  const vehicleTypeRaw = docket.vehicle_type || "regular";
  const dutyTypeRaw = docket.duty_type || "duty-free";

  if (!isVehicleType(vehicleTypeRaw)) {
    return <ErrorState docketId={id} message="Docket vehicle type is invalid for fee calculation." />;
  }

  if (!isDutyType(dutyTypeRaw)) {
    return <ErrorState docketId={id} message="Docket duty type is invalid for fee calculation." />;
  }

  let previewDocket: DocketReportRecord;
  let privateDealerOptions: PrivateDealerOptionRecord[];
  let auctionResearch: AuctionResearchRecord | null;
  let auctionEstimate: AuctionEstimateRecord | null;

  try {
    const exchange = await fetchJPYtoCAD();
    previewDocket = {
      ...docket,
      exchange_rate_at_report: exchange.rate,
      exchange_rate_date: exchange.date,
    };

    privateDealerOptions = await Promise.all(
      (submitPayload.privateDealerOptions ?? []).map(async (option) => {
        const fees = calculateImportCost({
          vehiclePriceJPY: option.dealerPriceJpy,
          destinationCity,
          vehicleType: vehicleTypeRaw,
          dutyType: dutyTypeRaw,
          exchangeRate: exchange.rate,
        });
        const signedPhotos = await Promise.all(option.photos.map((photo) => createSignedFileUrl(supabase, photo)));
        const signedSalesSheetUrl = option.salesSheetUrl
          ? await createSignedFileUrl(supabase, option.salesSheetUrl)
          : null;

        return {
          option_number: option.optionNumber,
          year: option.year,
          make: option.make,
          model: option.model,
          grade: option.grade,
          mileage: option.mileage,
          colour: option.colour,
          transmission: option.transmission,
          trim: option.trim,
          dealer_price_jpy: option.dealerPriceJpy,
          dealer_price_cad: fees.dealerPriceCAD,
          photos: signedPhotos,
          sales_sheet_url: signedSalesSheetUrl,
          marcus_notes: option.notes,
          calculated_fees: fees,
          total_delivered_cad: fees.totalDeliveredCAD,
        };
      })
    );

    auctionResearch = submitPayload.auctionListings
      ? {
          hammer_price_low_jpy: submitPayload.hammerPriceLowJpy ?? null,
          hammer_price_high_jpy: submitPayload.hammerPriceHighJpy ?? null,
          recommended_max_bid_jpy: submitPayload.recommendedMaxBidJpy ?? null,
          sales_history_notes: [submitPayload.salesHistoryNotes, submitPayload.overallNotes]
            .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
            .join("\n\n"),
          auction_listings: await Promise.all(
            submitPayload.auctionListings.map(async (listing) => ({
              lot_title: listing.lotTitle,
              specs: listing.specs,
              auction_lot_link: null,
              photos: await Promise.all(listing.photos.map((photo) => createSignedFileUrl(supabase, photo))),
            }))
          ),
        }
      : null;

    const midpointHammerJpy =
      submitPayload.auctionListings && submitPayload.hammerPriceLowJpy && submitPayload.hammerPriceHighJpy
        ? Math.round((submitPayload.hammerPriceLowJpy + submitPayload.hammerPriceHighJpy) / 2)
        : null;
    const auctionFees =
      midpointHammerJpy !== null
        ? calculateImportCost({
            vehiclePriceJPY: midpointHammerJpy,
            destinationCity,
            vehicleType: vehicleTypeRaw,
            dutyType: dutyTypeRaw,
            exchangeRate: exchange.rate,
          })
        : null;
    auctionEstimate =
      midpointHammerJpy !== null && auctionFees
        ? {
            docket_id: id,
            midpoint_hammer_jpy: midpointHammerJpy,
            midpoint_hammer_cad: auctionFees.dealerPriceCAD,
            calculated_fees: auctionFees,
            total_delivered_cad: auctionFees.totalDeliveredCAD,
            total_delivered_estimate_cad: auctionFees.totalDeliveredCAD,
          }
        : null;
  } catch (previewError) {
    return (
      <ErrorState
        docketId={id}
        message={previewError instanceof Error ? previewError.message : "Unable to calculate preview report."}
      />
    );
  }

  return (
    <PreviewClient
      auctionEstimate={auctionEstimate}
      auctionResearch={auctionResearch}
      docket={previewDocket}
      privateDealerOptions={privateDealerOptions}
      submitPayload={submitPayload}
    />
  );
}

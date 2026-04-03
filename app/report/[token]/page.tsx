import { notFound } from "next/navigation";

import {
  ReportClient,
  type AuctionEstimateRecord,
  type AuctionResearchRecord,
  type DocketReportRecord,
  type PrivateDealerOptionRecord,
} from "./ReportClient";

import { createServerClient } from "@/lib/supabase/server";

type ReportPageProps = {
  params: Promise<{ token: string }>;
};

type FeeBreakdown = NonNullable<PrivateDealerOptionRecord["calculated_fees"]>;
type JsonRecord = Record<string, unknown>;

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeFeeBreakdown(raw: unknown): FeeBreakdown | null {
  const parsed = parseJsonIfString(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const source = parsed as JsonRecord;
  const input = source.input;
  const inputExchangeRate =
    input && typeof input === "object" && !Array.isArray(input)
      ? toNumber((input as JsonRecord).exchangeRate)
      : undefined;

  return {
    vehiclePriceCAD: toNumber(source.vehiclePriceCAD ?? source.dealerPriceCAD ?? source.vehicleValueCAD),
    exportAgentFeeCAD: toNumber(source.exportAgentFeeCAD),
    shippingInsuranceCAD: toNumber(source.shippingInsuranceCAD),
    importDutyCAD: toNumber(source.importDutyCAD ?? source.dutyCAD),
    exciseTaxCAD: toNumber(source.exciseTaxCAD),
    gstCAD: toNumber(source.gstCAD),
    wwsTerminalFeeCAD: toNumber(source.wwsTerminalFeeCAD),
    brokerageFeeCAD: toNumber(source.brokerageFeeCAD),
    networkFeeCAD: toNumber(source.networkFeeCAD),
    financeAdminFeeCAD: toNumber(source.financeAdminFeeCAD),
    jdmRushFeeCAD: toNumber(source.jdmRushFeeCAD),
    inlandTransportCAD: toNumber(source.inlandTransportCAD ?? source.transportCostCAD),
    totalDeliveredCAD: toNumber(source.totalDeliveredCAD),
    pstCAD: toNumber(source.pstCAD),
    pstProvince: typeof source.pstProvince === "string" ? source.pstProvince : undefined,
    input: inputExchangeRate !== undefined ? { exchangeRate: inputExchangeRate } : undefined,
    dealerPriceCAD: toNumber(source.dealerPriceCAD),
    vehicleValueCAD: toNumber(source.vehicleValueCAD),
    dutyCAD: toNumber(source.dutyCAD),
    transportCostCAD: toNumber(source.transportCostCAD),
    pstRate: toNumber(source.pstRate),
  };
}

function extractStoragePath(photoPath: string): string {
  const trimmed = photoPath.trim();
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

async function createSignedPhotoUrl(
  supabase: ReturnType<typeof createServerClient>,
  photoPath: string
): Promise<string> {
  const storagePath = extractStoragePath(photoPath);
  if (!storagePath) {
    return photoPath;
  }

  const { data, error } = await supabase.storage
    .from("docket-files")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("[report] failed to sign photo path", { photoPath, storagePath, error });
    return photoPath;
  }

  return data.signedUrl;
}

export default async function CustomerReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, vehicle_year, vehicle_make, vehicle_model, budget_bracket, destination_city, destination_province, timeline, status, selected_path, selected_private_dealer_option, exchange_rate_at_report, exchange_rate_date"
    )
    .eq("report_url_token", token)
    .maybeSingle<DocketReportRecord>();

  if (docketError || !docket) {
    notFound();
  }

  const [{ data: auctionResearch }, { data: privateDealerOptions }, { data: auctionEstimate }] =
    await Promise.all([
      supabase
        .from("auction_research")
        .select(
          "hammer_price_low_jpy, hammer_price_high_jpy, recommended_max_bid_jpy, sales_history_notes, auction_listings"
        )
        .eq("docket_id", docket.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionResearchRecord>(),
      supabase
        .from("private_dealer_options")
        .select(
          "option_number, year, make, model, grade, mileage, colour, transmission, trim, dealer_price_jpy, dealer_price_cad, photos, marcus_notes, calculated_fees, total_delivered_cad"
        )
        .eq("docket_id", docket.id)
        .order("option_number", { ascending: true })
        .limit(3)
        .returns<PrivateDealerOptionRecord[]>(),
      supabase
        .from("auction_estimate")
        .select(
          "midpoint_hammer_jpy, midpoint_hammer_cad, calculated_fees, total_delivered_cad, total_delivered_estimate_cad"
        )
        .eq("docket_id", docket.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionEstimateRecord>(),
    ]);

  console.log("[report] raw private_dealer_options", privateDealerOptions);
  console.log(
    "[report] private_dealer_options.calculated_fees",
    (privateDealerOptions ?? []).map((option) => ({
      option_number: option.option_number,
      calculated_fees: option.calculated_fees,
      calculated_fees_type: typeof option.calculated_fees,
    }))
  );
  console.log("[report] auction_estimate.calculated_fees", {
    calculated_fees: auctionEstimate?.calculated_fees ?? null,
    calculated_fees_type: typeof auctionEstimate?.calculated_fees,
  });

  const normalizedPrivateDealerOptions = await Promise.all(
    (privateDealerOptions ?? []).map(async (option) => {
      const normalizedFees = normalizeFeeBreakdown(option.calculated_fees);
      const normalizedTotalDelivered = toNumber(option.total_delivered_cad) ?? null;

      if (
        normalizedFees &&
        normalizedFees.totalDeliveredCAD === undefined &&
        typeof normalizedTotalDelivered === "number"
      ) {
        normalizedFees.totalDeliveredCAD = normalizedTotalDelivered;
      }

      const signedPhotos = await Promise.all(
        (Array.isArray(option.photos) ? option.photos : [])
          .filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0)
          .map((photo) => createSignedPhotoUrl(supabase, photo))
      );

      return {
        ...option,
        calculated_fees: normalizedFees,
        photos: signedPhotos,
        total_delivered_cad: normalizedTotalDelivered,
      };
    })
  );

  const normalizedAuctionEstimate = auctionEstimate
    ? (() => {
        const normalizedFees = normalizeFeeBreakdown(auctionEstimate.calculated_fees);
        const normalizedTotalDelivered =
          toNumber(auctionEstimate.total_delivered_cad) ??
          toNumber(auctionEstimate.total_delivered_estimate_cad) ??
          null;

        if (
          normalizedFees &&
          normalizedFees.totalDeliveredCAD === undefined &&
          typeof normalizedTotalDelivered === "number"
        ) {
          normalizedFees.totalDeliveredCAD = normalizedTotalDelivered;
        }

        return {
          ...auctionEstimate,
          calculated_fees: normalizedFees,
          total_delivered_cad: normalizedTotalDelivered,
          total_delivered_estimate_cad:
            toNumber(auctionEstimate.total_delivered_estimate_cad) ?? normalizedTotalDelivered,
        };
      })()
    : null;

  const normalizedAuctionResearch = auctionResearch
    ? {
        ...auctionResearch,
        auction_listings: await Promise.all(
          (Array.isArray(auctionResearch.auction_listings) ? auctionResearch.auction_listings : []).map(
            async (listing) => {
              const signedPhotos = await Promise.all(
                (Array.isArray(listing.photos) ? listing.photos : [])
                  .filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0)
                  .map((photo) => createSignedPhotoUrl(supabase, photo))
              );

              return { ...listing, photos: signedPhotos };
            }
          )
        ),
      }
    : null;

  return (
    <ReportClient
      auctionEstimate={normalizedAuctionEstimate}
      auctionResearch={normalizedAuctionResearch}
      decisionEndpoint={`/api/customer/report/${token}/decision`}
      docket={docket}
      privateDealerOptions={normalizedPrivateDealerOptions}
      questionEndpoint={`/api/customer/report/${token}/question`}
    />
  );
}

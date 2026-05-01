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
  let parsed: unknown = value;

  // Some rows arrive as an object, some as a JSON string, and some as a double-encoded JSON string.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (typeof parsed !== "string") {
      return parsed;
    }

    const trimmed = parsed.trim();
    if (!trimmed) {
      return null;
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return parsed;
    }
  }

  return parsed;
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

  const { data, error } = await supabase.storage
    .from("docket-files")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("[report] failed to sign file path", { filePath, storagePath, error });
    return filePath;
  }

  return data.signedUrl;
}

export default async function CustomerReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const supabase = createServerClient();

  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("*")
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
          "option_number, year, make, model, grade, mileage, colour, transmission, trim, dealer_price_jpy, dealer_price_cad, photos, sales_sheet_url, marcus_notes, calculated_fees, total_delivered_cad"
        )
        .eq("docket_id", docket.id)
        .order("option_number", { ascending: true })
        .limit(3)
        .returns<PrivateDealerOptionRecord[]>(),
      supabase
        .from("auction_estimate")
        .select(
          "docket_id, midpoint_hammer_jpy, midpoint_hammer_cad, calculated_fees, total_delivered_estimate_cad"
        )
        .eq("docket_id", docket.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionEstimateRecord>(),
    ]);

  console.log("[report] fetched auction_estimate", auctionEstimate ?? null);
  console.log("[report] raw private_dealer_options", privateDealerOptions);
  console.log(
    "[report] raw private_dealer_options.calculated_fees",
    (privateDealerOptions ?? []).map((option) => ({
      option_number: option.option_number,
      calculated_fees: option.calculated_fees,
      calculated_fees_type: typeof option.calculated_fees,
    }))
  );
  console.log("[report] raw auction_estimate.calculated_fees", {
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
          .map((photo) => createSignedFileUrl(supabase, photo))
      );
      const signedSalesSheetUrl =
        typeof option.sales_sheet_url === "string" && option.sales_sheet_url.trim().length > 0
          ? await createSignedFileUrl(supabase, option.sales_sheet_url)
          : null;

      return {
        ...option,
        calculated_fees: normalizedFees,
        photos: signedPhotos,
        sales_sheet_url: signedSalesSheetUrl,
        total_delivered_cad: normalizedTotalDelivered,
      };
    })
  );

  const normalizedAuctionEstimate = auctionEstimate
    ? (() => {
        const normalizedFees = normalizeFeeBreakdown(auctionEstimate.calculated_fees);
        const normalizedTotalDelivered = toNumber(auctionEstimate.total_delivered_estimate_cad) ?? null;

        if (
          normalizedFees &&
          normalizedFees.totalDeliveredCAD === undefined &&
          typeof normalizedTotalDelivered === "number"
        ) {
          normalizedFees.totalDeliveredCAD = normalizedTotalDelivered;
        }

        return {
          ...auctionEstimate,
          midpoint_hammer_jpy: toNumber(auctionEstimate.midpoint_hammer_jpy) ?? null,
          midpoint_hammer_cad: toNumber(auctionEstimate.midpoint_hammer_cad) ?? null,
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
                  .map((photo) => createSignedFileUrl(supabase, photo))
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
      decisionEndpoint={`/api/customer/approve/${token}`}
      docket={docket}
      privateDealerOptions={normalizedPrivateDealerOptions}
      questionEndpoint={`/api/customer/report/${token}/question`}
    />
  );
}

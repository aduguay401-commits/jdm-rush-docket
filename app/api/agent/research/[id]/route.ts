import { sendEmail } from '@/lib/email';

import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import {
  calculateImportCost,
  type DutyType,
  type VehicleType,
  normalizeDestinationCity,
} from "@/lib/importCalculator";
import { createServerClient } from "@/lib/supabase/server";

type AuctionListingPayload = {
  lotTitle?: string;
  lot_title?: string;
  specs?: string;
  auctionLotLink?: string;
  auction_lot_link?: string;
  photos?: string[];
};

type PrivateDealerOptionPayload = {
  optionNumber?: number;
  option_number?: number;
  year?: string;
  make?: string;
  model?: string;
  grade?: string;
  mileage?: string;
  colour?: string;
  transmission?: "Manual" | "Auto";
  trim?: string;
  dealerPriceJpy?: number;
  dealer_price_jpy?: number;
  photos?: string[];
  salesSheetUrl?: string;
  sales_sheet_url?: string;
  notes?: string;
  marcus_notes?: string;
};

type ResearchPayload = {
  hammerPriceLowJpy?: number;
  hammer_price_low_jpy?: number;
  hammerPriceHighJpy?: number;
  hammer_price_high_jpy?: number;
  recommendedMaxBidJpy?: number;
  recommended_max_bid_jpy?: number;
  salesHistoryNotes?: string;
  sales_history_notes?: string;
  auctionListings?: AuctionListingPayload[];
  auction_listings?: AuctionListingPayload[];
  privateDealerOptions?: PrivateDealerOptionPayload[];
  private_dealer_options?: PrivateDealerOptionPayload[];
  overallNotes?: string;
  overall_notes?: string;
};

type SupabaseErrorLike = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function isVehicleType(value: string): value is VehicleType {
  return value === "regular" || value === "suv";
}

function isDutyType(value: string): value is DutyType {
  return value === "duty-free" || value === "full-duty";
}

function logStep(step: string, details?: unknown) {
  console.error("[Research API]", {
    step,
    at: new Date().toISOString(),
    details: details ?? null,
  });
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInteger(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric);
}

function parseJsonLikeString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return value;
    }
  }

  return value;
}

function normalizeStringArray(value: unknown) {
  const parsed = parseJsonLikeString(value);
  if (!Array.isArray(parsed)) {
    return [] as string[];
  }

  return parsed
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeAuctionListings(value: unknown) {
  const parsed = parseJsonLikeString(value);

  if (!Array.isArray(parsed)) {
    return [] as Array<{
      lot_title: string;
      specs: string;
      auction_lot_link: string | null;
      photos: string[];
    }>;
  }

  return parsed
    .map((item) => {
      const listing = item as AuctionListingPayload;
      const lotTitle = toNonEmptyString(listing?.lotTitle ?? listing?.lot_title);
      const specs = toNonEmptyString(listing?.specs);
      const auctionLotLink = toNonEmptyString(listing?.auctionLotLink ?? listing?.auction_lot_link);
      const photos = normalizeStringArray(listing?.photos);

      return {
        lot_title: lotTitle,
        specs,
        auction_lot_link: auctionLotLink || null,
        photos,
      };
    })
    .filter((item) => item.lot_title && item.specs);
}

function normalizeDealerOptions(value: unknown) {
  const parsed = parseJsonLikeString(value);

  if (!Array.isArray(parsed)) {
    return [] as Array<{
      option_number: number;
      year: string;
      make: string;
      model: string;
      grade: string;
      mileage: string;
      colour: string;
      transmission: string;
      trim: string;
      dealer_price_jpy: number;
      photos: string[];
      sales_sheet_url: string;
      marcus_notes: string;
    }>;
  }

  return parsed
    .map((item) => {
      const option = item as PrivateDealerOptionPayload;
      const optionNumberRaw = option?.optionNumber ?? option?.option_number;
      const optionNumber =
        typeof optionNumberRaw === "number"
          ? optionNumberRaw
          : typeof optionNumberRaw === "string"
          ? Number(optionNumberRaw)
          : null;
      const dealerPriceJpy = toPositiveInteger(option?.dealerPriceJpy ?? option?.dealer_price_jpy);

      return {
        option_number: Number.isInteger(optionNumber) ? optionNumber : null,
        year: toNonEmptyString(option?.year),
        make: toNonEmptyString(option?.make),
        model: toNonEmptyString(option?.model),
        grade: toNonEmptyString(option?.grade),
        mileage: toNonEmptyString(option?.mileage),
        colour: toNonEmptyString(option?.colour),
        transmission:
          option?.transmission === "Manual" || option?.transmission === "Auto"
            ? option.transmission
            : "Manual",
        trim: toNonEmptyString(option?.trim),
        dealer_price_jpy: dealerPriceJpy,
        photos: normalizeStringArray(option?.photos),
        sales_sheet_url: toNonEmptyString(option?.salesSheetUrl ?? option?.sales_sheet_url),
        marcus_notes: toNonEmptyString(option?.notes ?? option?.marcus_notes),
      };
    })
    .filter(
      (item) =>
        typeof item.option_number === "number" &&
        item.option_number >= 1 &&
        item.option_number <= 3 &&
        !!item.year &&
        !!item.make &&
        !!item.model &&
        !!item.dealer_price_jpy
    ) as Array<{
    option_number: number;
    year: string;
    make: string;
    model: string;
    grade: string;
    mileage: string;
    colour: string;
    transmission: string;
    trim: string;
    dealer_price_jpy: number;
    photos: string[];
    sales_sheet_url: string;
    marcus_notes: string;
  }>;
}

function toErrorObject(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    raw: error,
  };
}

function toSupabaseError(error: SupabaseErrorLike | null) {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
  };
}

function errorResponse(status: 400 | 500, message: string, details?: unknown) {
  const errorObject = {
    message,
    details: details ?? null,
    status,
    timestamp: new Date().toISOString(),
  };

  console.error("[Research API Error]", errorObject);

  return Response.json(
    {
      success: false,
      error: message,
      details: details ?? null,
      errorObject,
    },
    { status }
  );
}

function formDataToObject(formData: FormData) {
  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of formData.entries()) {
    const parsedValue =
      entryValue instanceof File
        ? {
            fileName: entryValue.name,
            fileType: entryValue.type,
            fileSize: entryValue.size,
          }
        : parseJsonLikeString(entryValue);

    if (result[key] !== undefined) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(parsedValue);
      } else {
        result[key] = [existing, parsedValue];
      }
      continue;
    }

    result[key] = parsedValue;
  }

  if (typeof result.payload === "string") {
    try {
      const payload = JSON.parse(result.payload) as Record<string, unknown>;
      delete result.payload;
      return { ...result, ...payload };
    } catch (error) {
      logStep("request.formdata.payload_parse_failed", {
        payload: result.payload,
        parseError: toErrorObject(error),
      });
    }
  }

  return result;
}

async function parseRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  logStep("request.content_type_detected", { contentType });

  if (contentType.includes("application/json")) {
    const parsedJson = (await request.json()) as unknown;
    logStep("request.body.json_parsed", parsedJson);
    return parsedJson;
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const parsedForm = formDataToObject(formData);
    logStep("request.body.formdata_parsed", parsedForm);
    return parsedForm;
  }

  const rawText = await request.text();
  logStep("request.body.raw_text", rawText);

  const parsedRaw = parseJsonLikeString(rawText);
  if (typeof parsedRaw === "string") {
    throw new Error("Unsupported request body format. Expected JSON or FormData.");
  }

  logStep("request.body.raw_text_parsed", parsedRaw);
  return parsedRaw;
}

function mapResearchPayload(rawBody: unknown): ResearchPayload {
  const body = (rawBody ?? {}) as ResearchPayload;

  return {
    hammerPriceLowJpy: toPositiveInteger(body.hammerPriceLowJpy ?? body.hammer_price_low_jpy) ?? undefined,
    hammerPriceHighJpy: toPositiveInteger(body.hammerPriceHighJpy ?? body.hammer_price_high_jpy) ?? undefined,
    recommendedMaxBidJpy:
      toPositiveInteger(body.recommendedMaxBidJpy ?? body.recommended_max_bid_jpy) ?? undefined,
    salesHistoryNotes: toNonEmptyString(body.salesHistoryNotes ?? body.sales_history_notes),
    auctionListings:
      (parseJsonLikeString(body.auctionListings ?? body.auction_listings) as AuctionListingPayload[]) ?? [],
    privateDealerOptions:
      (parseJsonLikeString(body.privateDealerOptions ?? body.private_dealer_options) as PrivateDealerOptionPayload[]) ??
      [],
    overallNotes: toNonEmptyString(body.overallNotes ?? body.overall_notes),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  logStep("handler.start");
  const { id } = await context.params;
  logStep("handler.params_resolved", { docketId: id });

  if (!id) {
    return errorResponse(400, "Docket ID is required.", {
      receivedParams: context.params,
    });
  }

  let rawBody: unknown;
  let payload: ResearchPayload;

  try {
    rawBody = await parseRequestBody(request);
    logStep("handler.request_body_received", rawBody);
    payload = mapResearchPayload(rawBody);
    logStep("handler.request_body_mapped", payload);
  } catch (parseError) {
    return errorResponse(400, "Invalid request body. Expected JSON or FormData payload.", {
      docketId: id,
      operation: "parseRequestBody",
      parseError: toErrorObject(parseError),
    });
  }

  try {
    const hammerPriceLowJpy = toPositiveInteger(payload.hammerPriceLowJpy);
    const hammerPriceHighJpy = toPositiveInteger(payload.hammerPriceHighJpy);
    const recommendedMaxBidJpy = toPositiveInteger(payload.recommendedMaxBidJpy);
    const salesHistoryNotes = toNonEmptyString(payload.salesHistoryNotes);
    const overallNotes = toNonEmptyString(payload.overallNotes);
    const auctionListings = normalizeAuctionListings(payload.auctionListings);
    const privateDealerOptions = normalizeDealerOptions(payload.privateDealerOptions);

    logStep("handler.normalized_payload", {
      docketId: id,
      hammerPriceLowJpy,
      hammerPriceHighJpy,
      recommendedMaxBidJpy,
      salesHistoryNotesLength: salesHistoryNotes.length,
      overallNotesLength: overallNotes.length,
      auctionListingsCount: auctionListings.length,
      privateDealerOptionsCount: privateDealerOptions.length,
      auctionListings,
      privateDealerOptions,
    });

    const validationErrors: string[] = [];

    if (!hammerPriceLowJpy || !hammerPriceHighJpy || !recommendedMaxBidJpy) {
      validationErrors.push(
        "Auction pricing fields are required and must be valid numbers (hammerPriceLowJpy, hammerPriceHighJpy, recommendedMaxBidJpy)."
      );
    }

    if (hammerPriceLowJpy && hammerPriceHighJpy && hammerPriceHighJpy < hammerPriceLowJpy) {
      validationErrors.push("Hammer high price must be greater than or equal to low price.");
    }

    if (auctionListings.length === 0) {
      validationErrors.push(
        "At least one auction listing is required. Required listing fields: lotTitle and specs (or lot_title/specs)."
      );
    }

    if (!privateDealerOptions.some((item) => item.option_number === 1)) {
      validationErrors.push(
        "Private dealer option 1 is required. Required fields: optionNumber, year, make, model, dealerPriceJpy."
      );
    }

    if (!overallNotes) {
      validationErrors.push("Overall notes are required (overallNotes or overall_notes).");
    }

    if (validationErrors.length > 0) {
      logStep("handler.validation_failed", { docketId: id, validationErrors, rawBody, mappedPayload: payload });
      return errorResponse(400, "Validation failed for research submission.", {
        docketId: id,
        validationErrors,
        expectedFieldNames: {
          camelCase: [
            "hammerPriceLowJpy",
            "hammerPriceHighJpy",
            "recommendedMaxBidJpy",
            "salesHistoryNotes",
            "auctionListings",
            "privateDealerOptions",
            "overallNotes",
          ],
          snakeCaseSupported: [
            "hammer_price_low_jpy",
            "hammer_price_high_jpy",
            "recommended_max_bid_jpy",
            "sales_history_notes",
            "auction_listings",
            "private_dealer_options",
            "overall_notes",
          ],
        },
      });
    }

    const validHammerPriceLowJpy = hammerPriceLowJpy as number;
    const validHammerPriceHighJpy = hammerPriceHighJpy as number;
    const validRecommendedMaxBidJpy = recommendedMaxBidJpy as number;
    const auctionResearchNotes = [salesHistoryNotes, overallNotes]
      .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
      .join("\n\n");

    const supabase = createServerClient();
    const serviceRoleSupabase = createServerClient();
    logStep("supabase.client_created", { docketId: id });

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select(
        "id, status, customer_first_name, customer_last_name, vehicle_year, vehicle_make, vehicle_model, destination_city, vehicle_type, duty_type"
      )
      .eq("id", id)
      .maybeSingle();
    logStep("supabase.dockets.select.result", {
      docket,
      error: toSupabaseError(docketError),
    });

    if (docketError) {
      return errorResponse(500, "Failed to load docket.", {
        operation: "dockets.select",
        docketId: id,
        supabase: toSupabaseError(docketError),
      });
    }

    if (!docket) {
      return errorResponse(400, "Docket not found.", { docketId: id });
    }
    const oldStatus = docket.status;

    const rawDestinationCity = toNonEmptyString(docket.destination_city);
    const destinationCity = rawDestinationCity ? normalizeDestinationCity(rawDestinationCity) : null;

    if (!destinationCity) {
      return errorResponse(400, "Docket destination city is missing or invalid for fee calculation.", {
        docketId: id,
        destinationCity: docket.destination_city,
      });
    }

    const vehicleTypeRaw = toNonEmptyString(docket.vehicle_type) || "regular";
    if (!isVehicleType(vehicleTypeRaw)) {
      return errorResponse(400, "Docket vehicle type is invalid for fee calculation.", {
        docketId: id,
        vehicleType: docket.vehicle_type,
      });
    }

    const dutyTypeRaw = toNonEmptyString(docket.duty_type) || "duty-free";
    if (!isDutyType(dutyTypeRaw)) {
      return errorResponse(400, "Docket duty type is invalid for fee calculation.", {
        docketId: id,
        dutyType: docket.duty_type,
      });
    }

    const midpointHammerJpy = Math.round((validHammerPriceLowJpy + validHammerPriceHighJpy) / 2);
    const exchange = await fetchJPYtoCAD();
    const auctionEstimateFees = calculateImportCost({
      vehiclePriceJPY: midpointHammerJpy,
      destinationCity,
      vehicleType: vehicleTypeRaw,
      dutyType: dutyTypeRaw,
      exchangeRate: exchange.rate,
    });
    const midpointHammerCad = auctionEstimateFees.dealerPriceCAD;
    logStep("exchange.rate_fetched", {
      docketId: id,
      exchange,
      midpointHammerJpy,
      midpointHammerCad,
      destinationCity,
      vehicleType: vehicleTypeRaw,
      dutyType: dutyTypeRaw,
    });

    const { data: clearedAuctionRows, error: clearAuctionResearchError } = await supabase
      .from("auction_research")
      .delete()
      .eq("docket_id", id)
      .select("id");
    logStep("supabase.auction_research.delete.result", {
      data: clearedAuctionRows,
      error: toSupabaseError(clearAuctionResearchError),
    });

    if (clearAuctionResearchError) {
      return errorResponse(500, "Failed to clear existing auction research.", {
        operation: "auction_research.delete",
        docketId: id,
        supabase: toSupabaseError(clearAuctionResearchError),
      });
    }

    const { data: insertedAuctionResearch, error: auctionResearchError } = await supabase
      .from("auction_research")
      .insert({
        docket_id: id,
        hammer_price_low_jpy: validHammerPriceLowJpy,
        hammer_price_high_jpy: validHammerPriceHighJpy,
        recommended_max_bid_jpy: validRecommendedMaxBidJpy,
        sales_history_notes: auctionResearchNotes,
        auction_listings: auctionListings,
      })
      .select("id");
    logStep("supabase.auction_research.insert.result", {
      data: insertedAuctionResearch,
      error: toSupabaseError(auctionResearchError),
    });

    if (auctionResearchError) {
      return errorResponse(500, "Failed to insert auction research.", {
        operation: "auction_research.insert",
        docketId: id,
        supabase: toSupabaseError(auctionResearchError),
      });
    }

    const { data: clearedDealerRows, error: clearDealerOptionsError } = await supabase
      .from("private_dealer_options")
      .delete()
      .eq("docket_id", id)
      .select("id");
    logStep("supabase.private_dealer_options.delete.result", {
      data: clearedDealerRows,
      error: toSupabaseError(clearDealerOptionsError),
    });

    if (clearDealerOptionsError) {
      return errorResponse(500, "Failed to clear existing private dealer options.", {
        operation: "private_dealer_options.delete",
        docketId: id,
        supabase: toSupabaseError(clearDealerOptionsError),
      });
    }

    const insertedDealerRows: Array<{ id: string; option_number: number }> = [];
    for (const item of privateDealerOptions) {
      const dealerInsertPayload = {
        docket_id: id,
        option_number: item.option_number,
        year: item.year,
        make: item.make,
        model: item.model,
        grade: item.grade,
        mileage: item.mileage,
        colour: item.colour,
        transmission: item.transmission,
        trim: item.trim,
        dealer_price_jpy: item.dealer_price_jpy,
        photos: item.photos,
        sales_sheet_url: item.sales_sheet_url || null,
        marcus_notes: item.marcus_notes || null,
      };
      logStep("supabase.private_dealer_options.insert.payload", {
        docketId: id,
        dealerInsertPayload,
      });

      const { data: insertedDealerRow, error: dealerInsertError } = await supabase
        .from("private_dealer_options")
        .insert(dealerInsertPayload)
        .select("id, option_number")
        .single();
      logStep("supabase.private_dealer_options.insert.result", {
        data: insertedDealerRow,
        error: toSupabaseError(dealerInsertError),
      });

      if (dealerInsertError || !insertedDealerRow) {
        return errorResponse(500, "Failed to insert private dealer option.", {
          operation: "private_dealer_options.insert",
          docketId: id,
          optionNumber: item.option_number,
          supabase: toSupabaseError(dealerInsertError),
        });
      }

      const dealerFees = calculateImportCost({
        vehiclePriceJPY: item.dealer_price_jpy,
        destinationCity,
        vehicleType: vehicleTypeRaw,
        dutyType: dutyTypeRaw,
        exchangeRate: exchange.rate,
      });

      const { data: updatedDealerRow, error: dealerUpdateError } = await supabase
        .from("private_dealer_options")
        .update({
          calculated_fees: dealerFees,
          total_delivered_cad: dealerFees.totalDeliveredCAD,
          dealer_price_cad: dealerFees.dealerPriceCAD,
        })
        .eq("id", insertedDealerRow.id)
        .select("id, option_number")
        .single();
      logStep("supabase.private_dealer_options.update_fees.result", {
        data: updatedDealerRow,
        error: toSupabaseError(dealerUpdateError),
      });

      if (dealerUpdateError || !updatedDealerRow) {
        return errorResponse(500, "Failed to update private dealer option fee calculations.", {
          operation: "private_dealer_options.update",
          docketId: id,
          privateDealerOptionId: insertedDealerRow.id,
          optionNumber: item.option_number,
          supabase: toSupabaseError(dealerUpdateError),
        });
      }

      insertedDealerRows.push(updatedDealerRow);
    }

    const { data: clearedEstimateRows, error: clearEstimateError } = await supabase
      .from("auction_estimate")
      .delete()
      .eq("docket_id", id)
      .select("id");
    logStep("supabase.auction_estimate.delete.result", {
      data: clearedEstimateRows,
      error: toSupabaseError(clearEstimateError),
    });

    if (clearEstimateError) {
      return errorResponse(500, "Failed to clear existing auction estimate.", {
        operation: "auction_estimate.delete",
        docketId: id,
        supabase: toSupabaseError(clearEstimateError),
      });
    }

    const { data: insertedEstimateRows, error: estimateError } = await supabase
      .from("auction_estimate")
      .insert({
        docket_id: id,
        midpoint_hammer_jpy: midpointHammerJpy,
        midpoint_hammer_cad: midpointHammerCad,
        calculated_fees: auctionEstimateFees,
        total_delivered_estimate_cad: auctionEstimateFees.totalDeliveredCAD,
      })
      .select("id");
    logStep("supabase.auction_estimate.insert.result", {
      data: insertedEstimateRows,
      error: toSupabaseError(estimateError),
    });

    if (estimateError) {
      return errorResponse(500, "Failed to insert auction estimate.", {
        operation: "auction_estimate.insert",
        docketId: id,
        supabase: toSupabaseError(estimateError),
      });
    }

    const { data: docketUpdateRows, error: docketUpdateError } = await supabase
      .from("dockets")
      .update({
        status: "report_sent",
        exchange_rate_at_report: exchange.rate,
        exchange_rate_date: exchange.date,
      })
      .eq("id", id)
      .select("id, status, exchange_rate_at_report, exchange_rate_date");
    logStep("supabase.dockets.update.result", {
      data: docketUpdateRows,
      error: toSupabaseError(docketUpdateError),
    });

    if (docketUpdateError) {
      return errorResponse(500, "Failed to update docket status.", {
        operation: "dockets.update",
        docketId: id,
        supabase: toSupabaseError(docketUpdateError),
      });
    }

    const { error: statusHistoryError } = await serviceRoleSupabase.from("docket_status_history").insert({
      docket_id: id,
      old_status: oldStatus,
      new_status: "report_sent",
      changed_by: "agent",
    });

    if (statusHistoryError) {
      return errorResponse(500, "Failed to insert docket status history.", {
        operation: "docket_status_history.insert",
        docketId: id,
        supabase: toSupabaseError(statusHistoryError),
      });
    }
    const fromEmail = process.env.FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const devMode = process.env.DEV_MODE === "true";
    logStep("email.config_checked", {
      hasFromEmail: !!fromEmail,
      hasAdminEmail: !!adminEmail,
      devMode,
    });

    if (!fromEmail) {
      return errorResponse(500, "Email configuration is missing.", {
        missingFromEmail: !fromEmail,
      });
    }
    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const vehicleSummary = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(" ");
    const devPrefix = devMode ? "[DEV MODE]\n\n" : "";

    try {
      logStep("email.send.attempt", {
        docketId: id,
        to: adminEmail ?? "adam@jdmrushimports.ca",
        from: fromEmail,
      });
      const subject = `Research report submitted for docket ${id}`;
      const bodySnapshot = `${devPrefix}Marcus submitted research for docket ${id}.

Customer: ${customerName || "Unknown Customer"}
Vehicle: ${vehicleSummary || "Unknown Vehicle"}
Hammer Range (JPY): ${validHammerPriceLowJpy.toLocaleString()} - ${validHammerPriceHighJpy.toLocaleString()}
Recommended Max Bid (JPY): ${validRecommendedMaxBidJpy.toLocaleString()}
Midpoint Hammer (JPY): ${midpointHammerJpy.toLocaleString()}
FX (JPY->CAD): ${exchange.rate}
Midpoint Hammer (CAD): ${midpointHammerCad.toLocaleString()}
Auction Listings: ${auctionListings.length}
Private Dealer Options: ${privateDealerOptions.length}

Overall Notes:
${overallNotes}`;
      const recipientEmail = adminEmail ?? "adam@jdmrushimports.ca";

      const sendResult = await sendEmail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text: bodySnapshot,
      });

      if (sendResult.error) {
        return errorResponse(500, "Research saved but failed to send notification email.", {
          operation: "resend.emails.send",
          docketId: id,
          emailError: sendResult.error,
        });
      }

      const { error: emailLogError } = await serviceRoleSupabase.from("email_log").insert({
        docket_id: id,
        email_type: "email_4_report_ready",
        recipient_email: recipientEmail,
        subject,
        body_snapshot: bodySnapshot,
      });

      if (emailLogError) {
        return errorResponse(500, "Research saved but failed to log report email.", {
          operation: "email_log.insert",
          docketId: id,
          supabase: toSupabaseError(emailLogError),
        });
      }
      logStep("email.send.success", { docketId: id });
    } catch (emailError) {
      logStep("email.send.failed", {
        docketId: id,
        emailError: toErrorObject(emailError),
      });
      return errorResponse(500, "Research saved but failed to send notification email.", {
        operation: "resend.emails.send",
        docketId: id,
        emailError: toErrorObject(emailError),
      });
    }

    logStep("handler.success", { docketId: id });
    return Response.json({
      success: true,
      message: "Research report submitted successfully.",
    });
  } catch (unexpectedError) {
    logStep("handler.unexpected_error", {
      docketId: id,
      unexpectedError: toErrorObject(unexpectedError),
    });
    return errorResponse(500, "Unexpected server error during research submission.", {
      docketId: id,
      unexpectedError: toErrorObject(unexpectedError),
    });
  }
}

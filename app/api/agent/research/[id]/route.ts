import { Resend } from "resend";

import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import { createServerClient } from "@/lib/supabase/server";

type AuctionListingPayload = {
  lotTitle?: string;
  specs?: string;
  auctionLotLink?: string;
  photos?: string[];
};

type PrivateDealerOptionPayload = {
  optionNumber?: number;
  year?: string;
  make?: string;
  model?: string;
  grade?: string;
  mileage?: string;
  colour?: string;
  transmission?: "Manual" | "Auto";
  trim?: string;
  dealerPriceJpy?: number;
  photos?: string[];
  salesSheetUrl?: string;
  notes?: string;
};

type ResearchPayload = {
  hammerPriceLowJpy?: number;
  hammerPriceHighJpy?: number;
  recommendedMaxBidJpy?: number;
  salesHistoryNotes?: string;
  auctionListings?: AuctionListingPayload[];
  privateDealerOptions?: PrivateDealerOptionPayload[];
  overallNotes?: string;
};

type SupabaseErrorLike = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function toNonEmptyString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeAuctionListings(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      lot_title: string;
      specs: string;
      auction_lot_link: string | null;
      photos: string[];
    }>;
  }

  return value
    .map((item) => {
      const lotTitle = toNonEmptyString(item?.lotTitle);
      const specs = toNonEmptyString(item?.specs);
      const auctionLotLink = toNonEmptyString(item?.auctionLotLink);
      const photos = normalizeStringArray(item?.photos);

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
  if (!Array.isArray(value)) {
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

  return value
    .map((item) => {
      const optionNumber =
        typeof item?.optionNumber === "number" && Number.isInteger(item.optionNumber)
          ? item.optionNumber
          : null;
      const dealerPriceJpy = toPositiveInteger(item?.dealerPriceJpy);

      return {
        option_number: optionNumber,
        year: toNonEmptyString(item?.year),
        make: toNonEmptyString(item?.make),
        model: toNonEmptyString(item?.model),
        grade: toNonEmptyString(item?.grade),
        mileage: toNonEmptyString(item?.mileage),
        colour: toNonEmptyString(item?.colour),
        transmission:
          item?.transmission === "Manual" || item?.transmission === "Auto"
            ? item.transmission
            : "Manual",
        trim: toNonEmptyString(item?.trim),
        dealer_price_jpy: dealerPriceJpy,
        photos: normalizeStringArray(item?.photos),
        sales_sheet_url: toNonEmptyString(item?.salesSheetUrl),
        marcus_notes: toNonEmptyString(item?.notes),
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
      errorObject,
    },
    { status }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return errorResponse(400, "Docket ID is required.");
  }

  let payload: ResearchPayload;

  try {
    payload = (await request.json()) as ResearchPayload;
  } catch (parseError) {
    return errorResponse(400, "Invalid request body.", {
      operation: "request.json",
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

    const validationErrors: string[] = [];

    if (!hammerPriceLowJpy || !hammerPriceHighJpy || !recommendedMaxBidJpy) {
      validationErrors.push("Auction pricing fields are required and must be valid numbers.");
    }

    if (hammerPriceLowJpy && hammerPriceHighJpy && hammerPriceHighJpy < hammerPriceLowJpy) {
      validationErrors.push("Hammer high price must be greater than or equal to low price.");
    }

    if (auctionListings.length === 0) {
      validationErrors.push("At least one auction listing with Lot Title and Specs is required.");
    }

    if (!privateDealerOptions.some((item) => item.option_number === 1)) {
      validationErrors.push("Private Dealer Option 1 is required.");
    }

    if (!overallNotes) {
      validationErrors.push("Overall notes are required.");
    }

    if (validationErrors.length > 0) {
      return errorResponse(400, "Validation failed for research submission.", {
        validationErrors,
      });
    }

    const validHammerPriceLowJpy = hammerPriceLowJpy as number;
    const validHammerPriceHighJpy = hammerPriceHighJpy as number;
    const validRecommendedMaxBidJpy = recommendedMaxBidJpy as number;

    const supabase = createServerClient();

    const { data: docket, error: docketError } = await supabase
      .from("dockets")
      .select("id, customer_first_name, customer_last_name, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", id)
      .maybeSingle();

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

    const midpointHammerJpy = Math.round((validHammerPriceLowJpy + validHammerPriceHighJpy) / 2);
    const exchange = await fetchJPYtoCAD();
    const midpointHammerCad = Number((midpointHammerJpy * exchange.rate).toFixed(2));

    const { error: clearAuctionResearchError } = await supabase
      .from("auction_research")
      .delete()
      .eq("docket_id", id);

    if (clearAuctionResearchError) {
      return errorResponse(500, "Failed to clear existing auction research.", {
        operation: "auction_research.delete",
        docketId: id,
        supabase: toSupabaseError(clearAuctionResearchError),
      });
    }

    const { error: auctionResearchError } = await supabase.from("auction_research").insert({
      docket_id: id,
      hammer_price_low_jpy: validHammerPriceLowJpy,
      hammer_price_high_jpy: validHammerPriceHighJpy,
      recommended_max_bid_jpy: validRecommendedMaxBidJpy,
      sales_history_notes: salesHistoryNotes,
      auction_listings: auctionListings,
    });

    if (auctionResearchError) {
      return errorResponse(500, "Failed to insert auction research.", {
        operation: "auction_research.insert",
        docketId: id,
        supabase: toSupabaseError(auctionResearchError),
      });
    }

    const { error: clearDealerOptionsError } = await supabase
      .from("private_dealer_options")
      .delete()
      .eq("docket_id", id);

    if (clearDealerOptionsError) {
      return errorResponse(500, "Failed to clear existing private dealer options.", {
        operation: "private_dealer_options.delete",
        docketId: id,
        supabase: toSupabaseError(clearDealerOptionsError),
      });
    }

    const dealerRows = privateDealerOptions.map((item) => ({
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
      dealer_price_cad: Number((item.dealer_price_jpy * exchange.rate).toFixed(2)),
      photos: item.photos,
      sales_sheet_url: item.sales_sheet_url || null,
      marcus_notes: item.marcus_notes || null,
    }));

    const { error: dealerOptionsError } = await supabase.from("private_dealer_options").insert(dealerRows);

    if (dealerOptionsError) {
      return errorResponse(500, "Failed to insert private dealer options.", {
        operation: "private_dealer_options.insert",
        docketId: id,
        supabase: toSupabaseError(dealerOptionsError),
      });
    }

    const { error: clearEstimateError } = await supabase
      .from("auction_estimate")
      .delete()
      .eq("docket_id", id);

    if (clearEstimateError) {
      return errorResponse(500, "Failed to clear existing auction estimate.", {
        operation: "auction_estimate.delete",
        docketId: id,
        supabase: toSupabaseError(clearEstimateError),
      });
    }

    const { error: estimateError } = await supabase.from("auction_estimate").insert({
      docket_id: id,
      midpoint_hammer_jpy: midpointHammerJpy,
      midpoint_hammer_cad: midpointHammerCad,
      calculated_fees: { overall_notes: overallNotes },
    });

    if (estimateError) {
      return errorResponse(500, "Failed to insert auction estimate.", {
        operation: "auction_estimate.insert",
        docketId: id,
        supabase: toSupabaseError(estimateError),
      });
    }

    const { error: docketUpdateError } = await supabase
      .from("dockets")
      .update({
        status: "report_sent",
        exchange_rate_at_report: exchange.rate,
        exchange_rate_date: exchange.date,
      })
      .eq("id", id);

    if (docketUpdateError) {
      return errorResponse(500, "Failed to update docket status.", {
        operation: "dockets.update",
        docketId: id,
        supabase: toSupabaseError(docketUpdateError),
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const devMode = process.env.DEV_MODE === "true";

    if (!resendApiKey || !fromEmail) {
      return errorResponse(500, "Email configuration is missing.", {
        missingResendApiKey: !resendApiKey,
        missingFromEmail: !fromEmail,
      });
    }

    const resend = new Resend(resendApiKey);
    const customerName = [docket.customer_first_name, docket.customer_last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    const vehicleSummary = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(" ");
    const devPrefix = devMode ? "[DEV MODE]\n\n" : "";

    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail ?? "adam@jdmrushimports.ca",
        subject: `Research report submitted for docket ${id}`,
        text: `${devPrefix}Marcus submitted research for docket ${id}.

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
${overallNotes}`,
      });
    } catch (emailError) {
      return errorResponse(500, "Research saved but failed to send notification email.", {
        operation: "resend.emails.send",
        docketId: id,
        emailError: toErrorObject(emailError),
      });
    }

    return Response.json({
      success: true,
      message: "Research report submitted successfully.",
    });
  } catch (unexpectedError) {
    return errorResponse(500, "Unexpected server error during research submission.", {
      docketId: id,
      unexpectedError: toErrorObject(unexpectedError),
    });
  }
}

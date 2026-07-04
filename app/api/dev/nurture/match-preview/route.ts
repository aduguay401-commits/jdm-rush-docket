import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import { fetchJapanStockInventory } from "@/lib/inventory/japanStock";
import {
  matchLeadSavedSearchToJapanStockInventory,
  type LeadSavedSearchAnchor,
} from "@/lib/nurture/matching";

const DEV_MODE = process.env.DEV_MODE === "true";

type PreviewRequestBody = {
  saved_search_id?: string;
  exchange_rate?: number;
  anchor?: Partial<LeadSavedSearchAnchor>;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function POST(request: Request) {
  if (!DEV_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body: PreviewRequestBody = await request.json();
    const supabase = createServerClient();
    let anchor: LeadSavedSearchAnchor | null = null;

    if (body.saved_search_id) {
      const { data, error } = await supabase
        .from("lead_saved_searches")
        .select(
          [
            "docket_id",
            "email",
            "anchor_ref",
            "anchor_url",
            "anchor_year",
            "anchor_make",
            "anchor_model",
            "anchor_model_key",
            "anchor_price_jpy",
            "anchor_card_estimate_cad",
            "anchor_duty_type",
            "destination_city",
            "price_band_percent",
            "fallback_price_band_percent",
            "year_window",
            "fallback_year_window",
            "max_matches",
            "active",
          ].join(","),
        )
        .eq("id", body.saved_search_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return NextResponse.json(
          { error: "saved_search_id not found" },
          { status: 404 },
        );
      }

      anchor = data as unknown as LeadSavedSearchAnchor;
    } else if (body.anchor) {
      const required = body.anchor;
      anchor = {
        docket_id: required.docket_id ?? "preview",
        email: required.email ?? "preview@example.com",
        anchor_ref: required.anchor_ref ?? null,
        anchor_url: required.anchor_url ?? null,
        anchor_year: required.anchor_year ?? null,
        anchor_make: required.anchor_make ?? null,
        anchor_model: required.anchor_model ?? null,
        anchor_model_key: required.anchor_model_key ?? null,
        anchor_price_jpy: required.anchor_price_jpy ?? null,
        anchor_card_estimate_cad: required.anchor_card_estimate_cad ?? null,
        anchor_duty_type: required.anchor_duty_type ?? null,
        destination_city: required.destination_city ?? null,
        price_band_percent: required.price_band_percent ?? 0.15,
        fallback_price_band_percent: required.fallback_price_band_percent ?? 0.25,
        year_window: required.year_window ?? 3,
        fallback_year_window: required.fallback_year_window ?? 5,
        max_matches: required.max_matches ?? 3,
        active: required.active ?? false,
      };
    } else {
      return NextResponse.json(
        { error: "saved_search_id or anchor is required" },
        { status: 400 },
      );
    }

    const exchangeRate =
      toNumber(body.exchange_rate) ?? (await fetchJPYtoCAD()).rate;
    const inventory = await fetchJapanStockInventory();
    const result = matchLeadSavedSearchToJapanStockInventory(
      anchor,
      inventory,
      exchangeRate,
    );

    return NextResponse.json({
      ...result,
      inventory_rows: inventory.length,
    });
  } catch (error) {
    console.error("[dev/nurture/match-preview] unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

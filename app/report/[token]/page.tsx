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
        .select("midpoint_hammer_jpy, midpoint_hammer_cad, calculated_fees, total_delivered_estimate_cad")
        .eq("docket_id", docket.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AuctionEstimateRecord>(),
    ]);

  return (
    <ReportClient
      auctionEstimate={auctionEstimate ?? null}
      auctionResearch={auctionResearch ?? null}
      decisionEndpoint={`/api/customer/report/${token}/decision`}
      docket={docket}
      privateDealerOptions={privateDealerOptions ?? []}
      questionEndpoint={`/api/customer/report/${token}/question`}
    />
  );
}

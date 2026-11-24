import { getJdmRushFee } from "@/lib/importCalculator";

type Db = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * The deposit (= JDM Rush service fee) for the car the customer approved,
 * tiered by its CAD purchase price: the chosen dealer option's price, or the
 * auction estimate's midpoint hammer price. Null when no price is on file.
 * Never throws: approval must not fail over the admin email's deposit line.
 */
export async function depositForApproval(
  db: Db,
  docketId: string,
  path: "private_dealer" | "auction",
  dealerIndex: number | null | undefined
): Promise<{ depositCad: number | null; vehiclePriceCad: number | null }> {
  const none = { depositCad: null, vehiclePriceCad: null };
  try {
    let price: number | null = null;
    if (path === "private_dealer" && dealerIndex) {
      const { data } = await db
        .from("private_dealer_options")
        .select("dealer_price_cad")
        .eq("docket_id", docketId)
        .eq("option_number", dealerIndex)
        .maybeSingle();
      price = Number(data?.dealer_price_cad) || null;
    } else if (path === "auction") {
      const { data } = await db
        .from("auction_estimate")
        .select("midpoint_hammer_cad")
        .eq("docket_id", docketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      price = Number(data?.midpoint_hammer_cad) || null;
    }
    return price ? { depositCad: getJdmRushFee(price), vehiclePriceCad: price } : none;
  } catch (error) {
    console.error("[deposit] lookup failed", error);
    return none;
  }
}

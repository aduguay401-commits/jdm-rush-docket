import { NextResponse } from "next/server";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";
import { calculateCardEstimate } from "@/lib/importCalculator";
import type { DutyType } from "@/lib/importCalculator";
import { fetchJapanStockInventory } from "@/lib/inventory/japanStock";

/**
 * GET /api/pricing/estimates
 *
 * Public, server-to-server endpoint.  The jdm-rush-next site calls this
 * at build/ISR time to get landed CAD estimates for every car in the
 * inventory without duplicating pricing logic.
 *
 * Response shape (200):
 *   { rate: number, rateDate: string, estimates: [{ ref, estimateCAD }...] }
 *
 * Errors return a non-200 status so callers can fall back gracefully.
 */

export async function GET() {
  try {
    // 1. Live JPY→CAD exchange rate (BoC, with hardcoded fallback)
    const { rate, date: rateDate } = await fetchJPYtoCAD();

    // 2. Fetch inventory from R2 via the shared helper
    const inventory = await fetchJapanStockInventory();

    // 3. Compute card estimate for every car with a valid price
    const estimates: { ref: string; estimateCAD: number }[] = [];

    for (const car of inventory) {
      const ref = car.ref;
      const jpyFob = car.jpy_fob_price;
      const dutyType = car.duty_type as DutyType;

      if (jpyFob <= 0 || jpyFob > 100_000_000) continue;
      if (!["duty-free", "full-duty"].includes(dutyType)) continue;

      const estimateCAD = calculateCardEstimate({
        vehiclePriceJPY: jpyFob,
        dutyType,
        exchangeRate: rate,
      });

      estimates.push({ ref, estimateCAD });
    }

    return NextResponse.json({
      rate,
      rateDate,
      estimates,
    });
  } catch (err) {
    console.error("[pricing/estimates] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

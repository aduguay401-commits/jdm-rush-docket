import { calculateImportCost, type DestinationCity } from "@/lib/importCalculator";
import { fetchJPYtoCAD } from "@/lib/exchangeRate";

// Map province codes to a default destination city for the calculator
const PROVINCE_CITY: Record<string, string> = {
  BC: "richmond-bc",
  AB: "calgary-ab",
  SK: "regina-sk",
  MB: "winnipeg-mb",
  ON: "toronto-on",
  QC: "montreal-qc",
  NB: "montreal-qc",
  NS: "montreal-qc",
  PE: "montreal-qc",
  NL: "montreal-qc",
};

export async function POST(request: Request) {
  let body: { jpyPrice?: number; province?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jpyPrice = Number(body.jpyPrice);
  const province = String(body.province ?? "").toUpperCase();

  if (!jpyPrice || jpyPrice < 100000) {
    return Response.json({ error: "jpyPrice must be at least 100,000" }, { status: 400 });
  }

  const destinationCity = PROVINCE_CITY[province];
  if (!destinationCity) {
    return Response.json(
      { error: `Unrecognized province: ${province}. Use AB, BC, MB, NB, NL, NS, ON, PE, QC, or SK.` },
      { status: 400 },
    );
  }

  const { rate, date } = await fetchJPYtoCAD();

  const breakdown = calculateImportCost({
    vehiclePriceJPY: jpyPrice,
    destinationCity: destinationCity as DestinationCity,
    vehicleType: "regular",
    dutyType: "duty-free",
    exchangeRate: rate,
  });

  return Response.json({
    rate,
    rateDate: date,
    // Flatten for the site's CalcBreakdown shape
    fobCAD: breakdown.vehicleValueCAD,
    freightCAD: breakdown.shippingInsuranceCAD + breakdown.transportCostCAD,
    duty: breakdown.dutyCAD,
    brokerFee: breakdown.brokerageFeeCAD,
    gst: breakdown.gstCAD,
    provincialTax: breakdown.pstCAD,
    provincialTaxRate: breakdown.pstRate,
    provincialTaxLabel: `PST (${(breakdown.pstRate * 100).toFixed(breakdown.pstRate === 0.09975 ? 3 : 0)}%)`,
    totalCAD: breakdown.totalDeliveredCAD,
    province: breakdown.province,
  });
}

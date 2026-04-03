import { calculateImportCost } from "@/lib/importCalculator";

export async function GET() {
  const result = calculateImportCost({
    vehiclePriceJPY: 2500000,
    destinationCity: "winnipeg-mb",
    vehicleType: "regular",
    dutyType: "duty-free",
    exchangeRate: 0.0092,
  });

  return Response.json(result);
}

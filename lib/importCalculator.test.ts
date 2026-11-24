import { describe, expect, it } from "vitest";
import { breakdownLines, calculateImportCost, getJdmRushFee } from "./importCalculator";

describe("JDM Rush service fee (= deposit)", () => {
  it("is tiered by the vehicle price in CAD", () => {
    expect(getJdmRushFee(10000)).toBe(1000);
    expect(getJdmRushFee(10000.01)).toBe(1500);
    expect(getJdmRushFee(20000)).toBe(1500);
    expect(getJdmRushFee(30000)).toBe(2000);
    expect(getJdmRushFee(30000.01)).toBe(3500);
  });
});

describe("breakdownLines", () => {
  it.each([500000, 2000000, 4500000, 9000000])("adds up to the total for ¥%i", (jpy) => {
    const b = calculateImportCost({
      vehiclePriceJPY: jpy,
      destinationCity: "toronto-on",
      vehicleType: "regular",
      dutyType: "duty-free",
      exchangeRate: 0.0091,
    });
    const lines = breakdownLines(b);
    const sum = lines.reduce((s, l) => s + l.amountCAD, 0);
    expect(Math.abs(sum - b.totalDeliveredCAD)).toBeLessThan(0.05);
    expect(lines.find((l) => l.key === "jdmRushFee")?.amountCAD).toBe(b.jdmRushFeeCAD);
    expect(lines.find((l) => l.key === "financeAdminFee")?.amountCAD).toBe(225);
  });
});

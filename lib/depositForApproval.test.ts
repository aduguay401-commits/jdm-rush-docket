import { describe, expect, it } from "vitest";
import { depositForApproval } from "./depositForApproval";

function fakeDb(rows: Record<string, Record<string, unknown> | null>, fail = false) {
  return {
    from(table: string) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (fail) throw new Error("db down");
          return { data: rows[table] ?? null, error: null };
        },
      };
      return q;
    },
  };
}

describe("depositForApproval", () => {
  it("tiers a dealer car by its CAD price", async () => {
    const r = await depositForApproval(fakeDb({ private_dealer_options: { dealer_price_cad: 28797 } }), "d1", "private_dealer", 2);
    expect(r).toEqual({ depositCad: 2000, vehiclePriceCad: 28797 });
  });
  it("tiers an auction car by the midpoint hammer price", async () => {
    const r = await depositForApproval(fakeDb({ auction_estimate: { midpoint_hammer_cad: 44800 } }), "d1", "auction", null);
    expect(r.depositCad).toBe(3500);
  });
  it("returns null when no price is on file or the lookup fails", async () => {
    expect((await depositForApproval(fakeDb({}), "d1", "auction", null)).depositCad).toBeNull();
    expect((await depositForApproval(fakeDb({}, true), "d1", "auction", null)).depositCad).toBeNull();
    expect((await depositForApproval(fakeDb({}), "d1", "private_dealer", null)).depositCad).toBeNull();
  });
});

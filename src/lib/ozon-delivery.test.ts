import { describe, expect, it } from "vitest";
import {
  isOzonFbsSchema,
  OZON_DELIVERY_SCHEMA,
  validSplits,
} from "./ozon-delivery";

describe("Ozon delivery schema", () => {
  it("uses only the seller warehouse FBS route", () => {
    expect(OZON_DELIVERY_SCHEMA).toBe("FBS");
    expect(isOzonFbsSchema("FBS")).toBe(true);
    expect(isOzonFbsSchema("FBO")).toBe(false);
    expect(isOzonFbsSchema("MIX")).toBe(false);
  });

  it("syncs an unavailable SKU even when Ozon mentions it in a split", () => {
    const line = {
      slug: "ub-10-250",
      title: "Сабвуфер UB-10.250 10 дюйм",
      sku: 4_083_328_303,
      offerId: "UB-10.250",
      inStock: true,
      quantity: 1,
      price: 3_825,
    };

    const state = validSplits(
      {
        splits: [
          {
            delivery_schema: "FBS",
            unavailable_reason: "NOT_AVAILABLE",
            items: [{ sku: line.sku, offer_id: line.offerId, quantity: 1 }],
          },
        ],
      },
      [line],
    );

    expect(state.missing).toEqual([line]);
    expect(state.syncCandidates).toEqual([line]);
  });
});

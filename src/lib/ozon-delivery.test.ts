import { describe, expect, it } from "vitest";
import { isOzonFbsSchema, OZON_DELIVERY_SCHEMA } from "./ozon-delivery";

describe("Ozon delivery schema", () => {
  it("uses only the seller warehouse FBS route", () => {
    expect(OZON_DELIVERY_SCHEMA).toBe("FBS");
    expect(isOzonFbsSchema("FBS")).toBe(true);
    expect(isOzonFbsSchema("FBO")).toBe(false);
    expect(isOzonFbsSchema("MIX")).toBe(false);
  });
});

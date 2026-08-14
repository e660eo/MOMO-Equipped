import { describe, expect, it } from "vitest";
import { dealerLocationKind, dealerSupportsInstallation, dealerSupportsSales } from "./dealer-location";
import type { DealerLocation } from "./types";

const base: DealerLocation = {
  id: "dealer-1",
  name: "Точка",
  city: "Москва",
  address: "Адрес",
  phone: "+7 900 000-00-00",
  active: true,
  createdAt: "2026-08-14T00:00:00.000Z",
};

describe("dealer location kind", () => {
  it("treats legacy dealer locations as stores", () => {
    expect(dealerLocationKind(base)).toBe("store");
    expect(dealerSupportsSales(base)).toBe(true);
    expect(dealerSupportsInstallation(base)).toBe(false);
  });

  it("keeps legacy authorized installation locations visible in both filters", () => {
    const dealer = { ...base, authorizedInstallation: true };
    expect(dealerLocationKind(dealer)).toBe("store_install");
    expect(dealerSupportsSales(dealer)).toBe(true);
    expect(dealerSupportsInstallation(dealer)).toBe(true);
  });

  it("distinguishes an installation-only center", () => {
    const dealer = { ...base, kind: "installation" as const };
    expect(dealerSupportsSales(dealer)).toBe(false);
    expect(dealerSupportsInstallation(dealer)).toBe(true);
  });
});

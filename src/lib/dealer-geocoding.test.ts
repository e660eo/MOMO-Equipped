import { describe, expect, it } from "vitest";
import { dealerGeocodeQuery, formatDealerCoordinate } from "./dealer-geocoding";

describe("dealerGeocodeQuery", () => {
  it("собирает город и адрес в российский поисковый запрос", () => {
    expect(dealerGeocodeQuery("  Краснодар ", " ул. Бородинская,   158 ")).toBe(
      "Россия, Краснодар, ул. Бородинская, 158",
    );
  });

  it("не ищет координаты, пока адрес заполнен не полностью", () => {
    expect(dealerGeocodeQuery("Махачкала", "")).toBe("");
    expect(dealerGeocodeQuery("", "пр-т Гамидова, 16")).toBe("");
  });
});

describe("formatDealerCoordinate", () => {
  it("округляет координату до шести знаков", () => {
    expect(formatDealerCoordinate(42.98491234)).toBe("42.984912");
    expect(formatDealerCoordinate(47.5)).toBe("47.5");
  });
});

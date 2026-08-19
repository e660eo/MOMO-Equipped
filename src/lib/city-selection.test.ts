import { describe, expect, it } from "vitest";
import {
  findRussianCities,
  parseStoredCityCenter,
  popularCityCenter,
  type RussianCityOption,
} from "./city-selection";

describe("city selection", () => {
  it("возвращает координаты популярного города", () => {
    expect(popularCityCenter("Казань")).toMatchObject({
      city: "Казань",
      lat: 55.7961,
      long: 49.1064,
    });
  });

  it("не использует координаты от ранее выбранного города", () => {
    const saved = JSON.stringify({ city: "Тверь", lat: 56.8587, long: 35.9176 });
    expect(parseStoredCityCenter(saved, "Тверь")).toEqual({
      city: "Тверь",
      lat: 56.8587,
      long: 35.9176,
    });
    expect(parseStoredCityCenter(saved, "Москва")).toBeNull();
    expect(parseStoredCityCenter("broken", "Тверь")).toBeNull();
  });

  it("ищет города без учёта регистра и различия е/ё", () => {
    const cities: RussianCityOption[] = [
      { city: "Орёл", region: "Орловская область", lat: 52.97, long: 36.06 },
      { city: "Оренбург", region: "Оренбургская область", lat: 51.77, long: 55.1 },
    ];
    expect(findRussianCities(cities, "ОРЕЛ").map((item) => item.city)).toEqual(["Орёл"]);
  });
});

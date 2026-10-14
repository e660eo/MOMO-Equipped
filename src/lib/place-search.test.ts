import { afterEach, expect, it, vi } from "vitest";
import { searchRussianPlaces } from "./place-search";
afterEach(() => vi.unstubAllGlobals());
it("finds cities locally without transmitting the query to a geocoder", async () => {
  const network = vi.fn(() => { throw new Error("Network must not be used"); });
  vi.stubGlobal("fetch", network);
  const results = await searchRussianPlaces("Москва");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].label).toContain("Москва");
  expect(Number.isFinite(results[0].lat)).toBe(true);
  expect(network).not.toHaveBeenCalled();
});


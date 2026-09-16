import { describe, it, expect } from "vitest";
import { fullSpecs, parseTech } from "./specs";
import { matchesSearch } from "./search-normalize";
import { cartSnapshot, reviewCart } from "./cart-review";
import { groupMapMarkers } from "./map-marker-groups";
import type { Product, ResolvedBundle } from "./types";
import type { PublicOzonPoint } from "./ozon-delivery";
import { bundleCartSlug } from "./bundle-cart";

const p = (slug: string, price = 1000, stock = 3): Product => ({ slug, price, stock, title: slug, category: "sabvufery", brand: "MOMO", image: "a.webp", inStock: true, isClearance: false });
describe("audit regressions", () => {
  it("uses explicit subwoofer RMS consistently and preserves dual coil notation", () => {
    const title = "Сабвуфер B-12.750 12 дюймов";
    const description = ["Номинальная мощность — 650 Вт", "Импеданс — 2+2 Ом"];
    expect(fullSpecs(title, description).stats).toContainEqual({ label: "Мощность RMS", value: "650 Вт" });
    expect(parseTech(title, description)).toMatchObject({ impedanceLabel: "2+2" });
    expect(parseTech(title, description).impedanceOhm).toBeUndefined();
    expect(fullSpecs(title).stats.some((s) => s.label.includes("RMS"))).toBe(false);
  });
  it.each(["HE815", "HE-815", "he 815", "MOMO HE815"])("finds model regardless of punctuation: %s", (q) => {
    expect(matchesSearch("Динамики MOMO HE-815 20см", "MOMO", q)).toBe(true);
    expect(matchesSearch("Динамики MOMO HE-810 20см", "MOMO", q)).toBe(false);
  });
  it("proposes price/stock changes without modifying the existing cart", () => {
    const old = [{ ...p("a"), qty: 3 }, { ...p("gone"), qty: 1 }];
    const before = structuredClone(old);
    const proposed = reviewCart(old, [p("a", 1300, 2), p("gone", 1000, 0)], []);
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ slug: "a", price: 1300, qty: 2 });
    expect(cartSnapshot(old)).not.toBe(cartSnapshot(proposed));
    expect(old).toEqual(before);
    expect(cartSnapshot(proposed)).toBe(cartSnapshot([...proposed].reverse()));
  });
  it("detects changed bundle composition even when its total is unchanged", () => {
    const a = p("a"), b = p("b");
    const bundle = { slug: "kit", title: "Kit", price: 2000, fullPrice: 2000, saving: 0, discountPercent: 0, products: [a, a] } as ResolvedBundle;
    const old = reviewCart([{ slug: bundleCartSlug("kit"), qty: 2 }], [a, b], [bundle]);
    expect(old[0].qty).toBe(1);
    expect(old[0].bundle?.items[0].qty).toBe(2);
    const changed = reviewCart([{ slug: bundleCartSlug("kit"), qty: 1 }], [a, b], [{ ...bundle, products: [a, b] }]);
    expect(cartSnapshot(old)).not.toBe(cartSnapshot(changed));
  });
  it("groups overlapping pickup markers, conserves counts and leaves selected point visible", () => {
    const point = (id: number, lat: number): PublicOzonPoint => ({ id, lat, long: 37.6, name: `Point ${id}`, address: "Address", distanceKm: 0 });
    const area = { points: [point(1, 55.75), point(2, 55.7501), point(3, 56)], clusters: [] };
    const original = structuredClone(area);
    const grouped = groupMapMarkers(area, 14);
    expect(grouped.clusters).toHaveLength(1);
    expect(grouped.clusters[0].pointsCount).toBe(2);
    expect(grouped.points.map((p) => p.id)).toEqual([3]);
    expect(groupMapMarkers(area, 14, 1).points.map((p) => p.id)).toContain(1);
    expect(area).toEqual(original);
  });
});

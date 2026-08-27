import { describe, expect, it } from "vitest";
import {
  buildAudioRecommendation,
  type AudioBuilderProduct,
} from "./audio-builder";

const products: AudioBuilderProduct[] = [
  { slug: "dinamiki-koaksialnye-zeus-ac-165-517978", title: "AC-165", price: 1_100, image: "a.webp", inStock: true },
  { slug: "kolonki-avtomobilnye-estradnye-165mm-momo-he-612-783658", title: "HE-612", price: 3_000, image: "b.webp", inStock: true },
  { slug: "kolonki-estradnye-avtomobilnye-165mm-bonnie-clyde-534149", title: "Bonnie", price: 5_000, image: "c.webp", inStock: true },
  { slug: "usilitel-avtomobilnyy-ab-2-60-617369", title: "AB-2.60", price: 2_700, image: "d.webp", inStock: true },
  { slug: "usilitel-avtomobilnyy-d-4-400-288535", title: "D-4.400", price: 9_000, image: "e.webp", inStock: true },
  { slug: "ustanovochnyy-komplekt-dlya-2-h-kanalnogo-avtomobilnogo-usil-259457", title: "KIT M082", price: 1_300, image: "f.webp", inStock: true },
  { slug: "ustanovochnyy-komplekt-dlya-4-kanalnogo-usilitelya-4ga-5-m-777635", title: "KIT M044", price: 2_600, image: "g.webp", inStock: true },
  { slug: "sabvufer-avtomobilnyy-ts-10-600-10-dyuymov-182054", title: "TS-10.600", price: 5_300, image: "h.webp", inStock: true },
  { slug: "monoblok-avtomobilnyy-zeus-m-600-611614", title: "M-600", price: 5_300, image: "i.webp", inStock: true },
  { slug: "rca-2-1-kabel-5m-med-123754", title: "RCA", price: 400, image: "j.webp", inStock: true },
];

describe("buildAudioRecommendation", () => {
  it("uses the common 165 mm size when the buyer does not know it", () => {
    const result = buildAudioRecommendation(products, {
      goal: "balanced",
      size: "unknown",
      budget: 10_000,
    });

    expect(result?.assumedSize).toBe("165");
    expect(result?.needsSizeCheck).toBe(true);
    expect(result?.id).toBe("balanced-165-start");
  });

  it("chooses the highest complete tier that fits the budget", () => {
    const result = buildAudioRecommendation(products, {
      goal: "balanced",
      size: "165",
      budget: 30_000,
    });

    expect(result?.id).toBe("balanced-165-full");
    expect(result?.isOverBudget).toBe(false);
    expect(result?.items).toHaveLength(6);
  });

  it("returns the cheapest complete system and marks the excess", () => {
    const result = buildAudioRecommendation(products, {
      goal: "balanced",
      size: "165",
      budget: 1_000,
    });

    expect(result?.id).toBe("balanced-165-start");
    expect(result?.isOverBudget).toBe(true);
    expect(result?.difference).toBe(6_000);
  });

  it("skips a preset when one of its products is unavailable", () => {
    const unavailable = products.map((product) =>
      product.slug === "kolonki-estradnye-avtomobilnye-165mm-bonnie-clyde-534149"
        ? { ...product, inStock: false }
        : product,
    );
    const result = buildAudioRecommendation(unavailable, {
      goal: "balanced",
      size: "165",
      budget: 30_000,
    });

    expect(result?.id).toBe("balanced-165-start");
  });
});

import { describe, expect, it } from "vitest";
import {
  hasInvalidListeningScore,
  hasPublishedListeningAudio,
  isListeningStandProduct,
  listeningAudioUrl,
  parseListeningScore,
} from "./listening-stand";
import type { Product } from "./types";

const product: Product = {
  slug: "momo-test",
  title: "MOMO Test",
  brand: "MOMO",
  category: "dinamiki-rupora",
  price: 1_000,
  image: "test.webp",
  isClearance: false,
};

describe("listening stand", () => {
  it("includes only MOMO/ZEUS horn speakers", () => {
    expect(isListeningStandProduct(product)).toBe(true);
    expect(isListeningStandProduct({ ...product, brand: "Other" })).toBe(false);
    expect(isListeningStandProduct({ ...product, category: "sabvufery" })).toBe(false);
  });

  it("publishes only an explicitly enabled recording", () => {
    expect(hasPublishedListeningAudio(product)).toBe(false);
    expect(
      hasPublishedListeningAudio({
        ...product,
        listening: { audio: "sample.mp3", published: true },
      }),
    ).toBe(true);
    expect(
      listeningAudioUrl({
        ...product,
        listening: { audio: "sample.mp3", published: true },
      }),
    ).toBe("/media/sample.mp3");
  });

  it("accepts scores from zero to ten with one decimal", () => {
    expect(parseListeningScore("7,25")).toBe(7.3);
    expect(parseListeningScore("0")).toBe(0);
    expect(parseListeningScore("10")).toBe(10);
    expect(parseListeningScore("")).toBeUndefined();
    expect(hasInvalidListeningScore("10.1")).toBe(true);
    expect(hasInvalidListeningScore("звук")).toBe(true);
  });
});

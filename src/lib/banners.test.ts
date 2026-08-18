import { describe, expect, it } from "vitest";
import { normalizeBannerHref, sortBanners } from "./banners";
import type { SiteBanner } from "./types";

function banner(id: string, order: number, createdAt: string): SiteBanner {
  return {
    id,
    name: id,
    media: `${id}.webp`,
    mediaType: "image",
    theme: "dark",
    mediaFit: "cover",
    mediaAlign: "center",
    action: { kind: "none" },
    active: true,
    order,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("managed banners", () => {
  it("sorts by explicit order and then creation time", () => {
    const sorted = sortBanners([
      banner("third", 20, "2026-08-18T00:00:02.000Z"),
      banner("second", 10, "2026-08-18T00:00:01.000Z"),
      banner("first", 10, "2026-08-18T00:00:00.000Z"),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });

  it("accepts internal and secure external links", () => {
    expect(normalizeBannerHref(" /catalog/sabvufery ")).toBe("/catalog/sabvufery");
    expect(normalizeBannerHref("https://example.ru/promo")).toBe("https://example.ru/promo");
  });

  it("rejects script, protocol-relative and insecure external links", () => {
    expect(() => normalizeBannerHref("javascript:alert(1)")).toThrow();
    expect(() => normalizeBannerHref("//example.ru/promo")).toThrow();
    expect(() => normalizeBannerHref("http://example.ru/promo")).toThrow();
  });
});

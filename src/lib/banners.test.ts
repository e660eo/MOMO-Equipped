import { describe, expect, it } from "vitest";
import { bannerAspectRatio, bannerLayout } from "./banner-layout";
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

  it("keeps legacy banners in the site-composed layout", () => {
    expect(bannerLayout(banner("legacy", 10, "2026-08-18T00:00:00.000Z"))).toBe("content");
    expect(bannerLayout({
      ...banner("artwork", 10, "2026-08-18T00:00:00.000Z"),
      layout: "artwork",
    })).toBe("artwork");
  });

  it("uses saved media dimensions only when they are valid", () => {
    expect(bannerAspectRatio({
      ...banner("wide", 10, "2026-08-18T00:00:00.000Z"),
      mediaWidth: 1920,
      mediaHeight: 720,
    })).toBeCloseTo(8 / 3);
    expect(bannerAspectRatio({
      ...banner("unknown", 10, "2026-08-18T00:00:00.000Z"),
      mediaWidth: 0,
      mediaHeight: 720,
    })).toBeUndefined();
  });
});

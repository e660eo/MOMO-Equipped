import type { BannerLayout, SiteBanner } from "./types";

export function bannerLayout(banner: SiteBanner): BannerLayout {
  return banner.layout === "artwork" ? "artwork" : "content";
}

export function bannerAspectRatio(banner: SiteBanner): number | undefined {
  if (
    !Number.isFinite(banner.mediaWidth) ||
    !Number.isFinite(banner.mediaHeight) ||
    Number(banner.mediaWidth) <= 0 ||
    Number(banner.mediaHeight) <= 0
  ) {
    return undefined;
  }
  return Number(banner.mediaWidth) / Number(banner.mediaHeight);
}

import type { Metadata } from "next";

export const DEFAULT_SOCIAL_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "MOMO — автомобильная акустика и аксессуары",
};

/** Единый self-canonical и полноценное превью для публичной страницы. */
export function publicPageMetadata(
  title: string,
  description: string,
  path: `/${string}` | "/",
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: "website",
      url: path,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE.url],
    },
  };
}

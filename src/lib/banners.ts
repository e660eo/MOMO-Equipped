import { ExpectedError } from "./errors";
import { readJson, updateJson } from "./store";
import type { SiteBanner } from "./types";

const FILE = "banners.json";

export function sortBanners(banners: SiteBanner[]): SiteBanner[] {
  return [...banners].sort(
    (a, b) =>
      a.order - b.order ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function getBanners(): SiteBanner[] {
  try {
    return sortBanners(readJson<SiteBanner[]>(FILE));
  } catch {
    return [];
  }
}

export function getActiveBanners(): SiteBanner[] {
  return getBanners().filter((banner) => banner.active);
}

export function upsertBanner(banner: SiteBanner): SiteBanner[] {
  return updateJson<SiteBanner[]>(FILE, (all) =>
    sortBanners(
      all.some((item) => item.id === banner.id)
        ? all.map((item) => (item.id === banner.id ? banner : item))
        : [...all, banner],
    ),
  );
}

export function removeBanner(id: string): SiteBanner | undefined {
  let removed: SiteBanner | undefined;
  updateJson<SiteBanner[]>(FILE, (all) => {
    removed = all.find((item) => item.id === id);
    return all.filter((item) => item.id !== id);
  });
  return removed;
}

/** Только внутренние адреса сайта и HTTPS-ссылки наружу. */
export function normalizeBannerHref(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
  } catch {
    // Ниже вернём понятную ошибку формы.
  }

  throw new ExpectedError(
    "Ссылка должна начинаться с / для страницы сайта или с https:// для внешнего адреса.",
  );
}

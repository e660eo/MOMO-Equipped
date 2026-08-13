import type { Product } from "./types";

export const LISTENING_STAND_CATEGORY = "dinamiki-rupora";
export const LISTENING_STAND_BRANDS = new Set(["MOMO", "ZEUS"]);
export const REFERENCE_TRACK_URL = "/audio/momo-reference-loop.wav";

export function isListeningStandProduct(product: Product): boolean {
  return (
    product.category === LISTENING_STAND_CATEGORY &&
    LISTENING_STAND_BRANDS.has(product.brand.trim().toUpperCase())
  );
}

export function hasPublishedListeningAudio(product: Product): boolean {
  return Boolean(product.listening?.published && product.listening.audio);
}

export function listeningAudioUrl(product: Product): string | undefined {
  if (!hasPublishedListeningAudio(product)) return undefined;
  const audio = product.listening?.audio;
  if (!audio) return undefined;
  return audio.startsWith("/") || audio.startsWith("http")
    ? audio
    : `/media/${audio}`;
}

export function parseListeningScore(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return undefined;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 && score <= 10
    ? Math.round(score * 10) / 10
    : undefined;
}

export function hasInvalidListeningScore(value: FormDataEntryValue | null): boolean {
  return String(value ?? "").trim() !== "" && parseListeningScore(value) === undefined;
}

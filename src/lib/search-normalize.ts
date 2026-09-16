export const normalizeSearch = (value: string) => value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");

export function matchesSearch(title: string, brand: string, query: string): boolean {
  const source = normalizeSearch(`${title} ${brand}`);
  return query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean).every((word) => source.includes(word));
}

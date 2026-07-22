/*
  Slug из русского названия товара.

  Правила транслитерации те же, по которым сделаны нынешние 142 адреса
  («Сабвуфер автомобильный ACHILLES 12 дюймов» → `sabvufer-avtomobilnyy-achilles-12-dyuymov`),
  чтобы новые карточки не выбивались из общего вида ссылок.
*/

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function slugify(title: string): string {
  const base = [...title.toLowerCase()]
    .map((ch) => MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "tovar";
}

/**
 * Уникальный slug: к занятому добавляем числовой хвост. Так же устроены
 * адреса, доставшиеся с прежней витрины («…-he-290-017173»).
 */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(title);
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

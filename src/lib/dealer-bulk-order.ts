export interface BulkProduct { slug: string; title: string; article?: string; stock: number | null; available: boolean; price: number }
export interface BulkOrderRow { line: number; query: string; qty: number; product?: BulkProduct; error?: string }
const normalize = (value: string) => value.normalize("NFKC").toLocaleUpperCase("ru").replace(/[МО]/g, (c) => c === "М" ? "M" : "O").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

export function parseBulkOrder(text: string, products: BulkProduct[], existing: Record<string, number> = {}): BulkOrderRow[] {
  if (text.length > 30000) return [{ line: 1, query: "", qty: 0, error: "Список слишком большой: не более 30 000 символов." }];
  const lines = text.split(/\r?\n/).map((value, index) => ({ value: value.trim(), line: index + 1 })).filter((item) => item.value);
  if (lines.length > 200) return [{ line: 1, query: "", qty: 0, error: "Вставьте не более 200 строк за один раз." }];
  const totals = { ...existing };
  return lines.flatMap(({ value, line }): BulkOrderRow[] => {
    if (/^(модель|артикул|товар|название)[\t;].*(кол|qty|quantity)/i.test(value)) return [];
    const cells = value.split(/\t|;/).map((cell) => cell.trim());
    const match = cells.length === 2 ? [value, cells[0], cells[1]] : cells.length > 2 ? null : value.match(/^(.+?)\s+(?:[-–—×x]\s*)?(\d+)\s*(?:шт\.?|pcs)?$/i);
    if (!match) return [{ line, query: value, qty: 0, error: "Нужны две колонки: модель и целое количество." }];
    const query = match[1].replace(/\s+[-–—×]$/, "").trim(), qty = Number(match[2]);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999) return [{ line, query, qty, error: "Количество должно быть от 1 до 999." }];
    const needle = normalize(query);
    let matches = products.filter((product) => [product.title, product.slug, product.article ?? ""].some((key) => normalize(key) === needle));
    // Models may occur inside a full product title, but never choose a fuzzy or ambiguous match.
    if (!matches.length && needle.length >= 4) matches = products.filter((product) => (` ${normalize(product.title)} `).includes(` ${needle} `));
    if (matches.length !== 1) return [{ line, query, qty, error: matches.length ? "Несколько вариантов. Укажите полное название или артикул из каталога." : "Товар не найден в доступном дилерском прайсе." }];
    const product = matches[0];
    const next = (totals[product.slug] ?? 0) + qty;
    totals[product.slug] = next;
    const limit = product.available ? Math.min(999, product.stock ?? 999) : 0;
    return [{ line, query, qty, product, ...(next > limit ? { error: `Вместе с черновиком нужно ${next}, доступно ${limit}.` } : {}) }];
  });
}

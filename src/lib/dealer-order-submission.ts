import crypto from "node:crypto";
import { ExpectedError } from "./errors";

export type DealerPriceChange = { slug: string; title: string; previousPrice: number; price: number };

export function parseDealerOrderSubmission(form: FormData) {
  const requestId = String(form.get("requestId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new ExpectedError("Обновите страницу заказа перед отправкой. Черновик сохранится.");
  }
  const rawItems = String(form.get("items") ?? "[]");
  const rawPrices = String(form.get("quotedPrices") ?? "{}");
  if (rawItems.length + rawPrices.length > 120_000) throw new ExpectedError("Слишком большой заказ. Разделите его на несколько заявок.");
  let rows: unknown, prices: unknown;
  try { rows = JSON.parse(rawItems); prices = JSON.parse(rawPrices); }
  catch { throw new ExpectedError("Не удалось прочитать состав заказа. Обновите страницу."); }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) throw new ExpectedError("Добавьте от 1 до 500 позиций в заказ.");
  if (!prices || typeof prices !== "object" || Array.isArray(prices)) throw new ExpectedError("Обновите цены перед отправкой заказа.");
  const quantities = new Map<string, number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new ExpectedError("Проверьте состав заказа.");
    const slug = typeof row.slug === "string" ? row.slug : "";
    const qty = row.qty;
    if (!slug || slug.length > 200 || typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 1 || qty > 999) throw new ExpectedError("Проверьте количество товаров.");
    const total = (quantities.get(slug) ?? 0) + qty;
    if (total > 999) throw new ExpectedError("В одной заявке допускается до 999 единиц одного товара.");
    quantities.set(slug, total);
  }
  const items = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([slug, qty]) => {
    const price = Object.prototype.hasOwnProperty.call(prices, slug) ? (prices as Record<string, unknown>)[slug] : undefined;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 100_000_000) throw new ExpectedError("Обновите цены перед отправкой заказа.");
    return { slug, qty, quotedPrice: Math.round(price * 100) / 100 };
  });
  const comment = String(form.get("comment") ?? "").trim().slice(0, 700);
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ items, comment })).digest("hex");
  return { requestId, items, comment, fingerprint };
}

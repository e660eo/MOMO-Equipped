import { currentDealer } from "@/lib/dealer-auth";
import { dealerPriceFor } from "@/lib/dealers";
import { toCsv } from "@/lib/csv";
import { getProducts } from "@/lib/data";
import { isInStock } from "@/lib/format";

export async function GET() {
  const session = await currentDealer();
  if (!session) return new Response("Требуется вход", { status: 401 });
  const rows: (string | number)[][] = [["Артикул", "Товар", "Бренд", "Категория", "РРЦ", "Дилерская цена", "Остаток"]];
  for (const product of getProducts().filter((item) => !item.isClearance && !item.hidden)) {
    const price = dealerPriceFor(product, session.account);
    if (price === undefined) continue;
    rows.push([
      product.ozonOfferId || product.slug,
      product.title,
      product.brand,
      product.category,
      product.price,
      price,
      typeof product.stock === "number" ? product.stock : isInStock(product) ? "В наличии" : "Под заказ",
    ]);
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="momo-dealer-price-${date}.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

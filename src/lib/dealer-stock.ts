import { ExpectedError } from "./errors";
import { readJson, writeJson, updateJson, withStoreTransaction } from "./store";
import type { DealerOrderStatus, OrderItem, Product } from "./types";

const FILE = "dealer-stock-reservations.json";
export interface DealerStockReservation { orderId: string; status: "reserved" | "shipped" | "released"; items: Array<{ slug: string; qty: number; title: string }>; updatedAt: string }
export function getDealerStockReservations(): DealerStockReservation[] {
  try { return readJson<DealerStockReservation[]>(FILE); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

/** Must commit together with agreement/status changes. Stock is already the quantity available to sell. */
export function reconcileDealerStock(orderId: string, status: DealerOrderStatus, paid: boolean, items: OrderItem[], historicalShipment = false): void {
  withStoreTransaction(() => {
    const all = getDealerStockReservations();
    const previous = all.find((item) => item.orderId === orderId);
    const shipped = status === "shipped" || status === "done";
    const target = status === "canceled" || !paid ? "released" : shipped ? "shipped" : "reserved";
    if (previous?.status === "shipped") {
      const same = items.length === previous.items.length && items.every((item) => previous.items.some((old) => old.slug === item.slug && old.qty === item.qty));
      if (!shipped || !paid || !same) throw new ExpectedError("Товар уже отгружен. Нельзя менять состав, отменять отгрузку или снимать оплату. Возврат нужно отдельно принять на склад.");
      return;
    }
    // Historical completed orders are not written off retroactively.
    if (shipped && !previous && historicalShipment) return;
    if (shipped && !paid) throw new ExpectedError("Сначала подтвердите полную оплату заказа.");
    const before = previous?.status === "reserved" ? previous.items : [];
    const grouped = new Map<string, { slug: string; qty: number; title: string }>();
    for (const { slug, qty, title } of items) {
      if (!Number.isSafeInteger(qty) || qty < 1) throw new ExpectedError("Проверьте количество товара в заказе.");
      grouped.set(slug, { slug, qty: (grouped.get(slug)?.qty ?? 0) + qty, title });
    }
    const next = target === "released" ? [] : [...grouped.values()];
    if (!before.length && !next.length) return;
    updateJson<Product[]>("products.json", (products) => {
      const oldQty = new Map(before.map((item) => [item.slug, item.qty]));
      const nextQty = new Map(next.map((item) => [item.slug, item.qty]));
      for (const item of next) {
        const product = products.find((row) => row.slug === item.slug);
        if (!product || !Number.isSafeInteger(product.stock) || product.stock! < 0) throw new ExpectedError(`Укажите числовой остаток товара «${item.title}» перед подтверждением оплаты.`);
        const available = product.stock! + (oldQty.get(item.slug) ?? 0);
        if (available < item.qty) throw new ExpectedError(`Недостаточно товара «${item.title}»: доступно для этого заказа ${available}, требуется ${item.qty}.`);
      }
      for (const item of before) if (!products.some((product) => product.slug === item.slug && typeof product.stock === "number")) throw new ExpectedError(`Нельзя освободить резерв «${item.title}»: восстановите карточку и числовой остаток.`);
      return products.map((product) => {
        const delta = (oldQty.get(product.slug) ?? 0) - (nextQty.get(product.slug) ?? 0);
        return delta && typeof product.stock === "number" ? { ...product, stock: product.stock + delta } : product;
      });
    });
    writeJson(FILE, [...all.filter((item) => item.orderId !== orderId), { orderId, status: target, items: next.length ? next : previous?.items ?? [], updatedAt: new Date().toISOString() } satisfies DealerStockReservation]);
  });
}

export function assertDealerReservedProducts(products: Product[]): void {
  for (const reservation of getDealerStockReservations().filter((item) => item.status === "reserved")) {
    for (const line of reservation.items) if (!products.some((product) => product.slug === line.slug && typeof product.stock === "number")) throw new ExpectedError(`Товар «${line.title}» зарезервирован для ${reservation.orderId}. Сначала освободите резерв; удалять карточку или убирать числовой остаток нельзя.`);
  }
}

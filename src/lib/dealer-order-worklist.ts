import type { DealerOrder, DealerLocation, DealerAccount } from "./types";
import type { DealerOrderAgreement } from "./dealer-order-management";

export const DEALER_WORK_TABS = [
  { value: "", label: "Все" }, { value: "new", label: "Новые" },
  { value: "awaiting-payment", label: "Ждут оплаты" }, { value: "ready", label: "К отгрузке" },
  { value: "shipped", label: "Отгружены" }, { value: "done", label: "Выполнены" },
  { value: "canceled", label: "Отменены" },
] as const;
export type DealerOrderFilters = { q?: string; view?: string; from?: string; to?: string; page?: string };
export function moscowDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export function matchesDealerView(order: DealerOrder, agreement: DealerOrderAgreement | undefined, view = ""): boolean {
  if (view === "awaiting-payment") return ["new", "confirmed"].includes(order.status) && Boolean(agreement) && agreement?.paymentStatus !== "paid";
  if (view === "ready") return ["new", "confirmed"].includes(order.status) && agreement?.paymentStatus === "paid";
  return !view || order.status === view;
}
export function filterDealerOrders(orders: DealerOrder[], agreements: Map<string, DealerOrderAgreement>, dealers: DealerLocation[], accounts: DealerAccount[], filters: DealerOrderFilters): DealerOrder[] {
  const dealerMap = new Map(dealers.map((d) => [d.id, d]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const query = filters.q?.trim().toLocaleLowerCase("ru") ?? "";
  return orders.filter((order) => {
    const dealer = dealerMap.get(order.dealerId), account = accountMap.get(order.accountId);
    const date = moscowDate(order.createdAt);
    return matchesDealerView(order, agreements.get(order.id), filters.view)
      && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      && (!query || [order.id, dealer?.name, dealer?.city, dealer?.phone, account?.contactName, account?.email].join(" ").toLocaleLowerCase("ru").includes(query));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function dealerOrdersUrl(filters: DealerOrderFilters): string {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]);
  return `/admin/dealers/orders${query.size ? `?${query}` : ""}`;
}

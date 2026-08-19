import type { DealerOrder, DealerOrderStatus } from "./types";

export const DEALER_ORDER_STATUS_LABELS: Record<DealerOrderStatus, string> = {
  new: "Отправлен",
  confirmed: "Подтверждён",
  shipped: "Отгружен",
  done: "Получен",
  canceled: "Отменён",
};

export const DEALER_ORDER_STEPS: Array<{
  status: Exclude<DealerOrderStatus, "canceled">;
  label: string;
}> = [
  { status: "new", label: "Отправлен" },
  { status: "confirmed", label: "Подтверждён" },
  { status: "shipped", label: "Отгружен" },
  { status: "done", label: "Получен" },
];

export function dealerOrderProgressIndex(status: DealerOrderStatus): number {
  if (status === "canceled") return -1;
  return DEALER_ORDER_STEPS.findIndex((step) => step.status === status);
}

export function isDealerOrderOpen(status: DealerOrderStatus): boolean {
  return status !== "done" && status !== "canceled";
}

export function dealerOrderUnitCount(order: Pick<DealerOrder, "items">): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

export function dealerOrderLastUpdated(order: Pick<DealerOrder, "createdAt" | "history">): string {
  return order.history.at(-1)?.at ?? order.createdAt;
}

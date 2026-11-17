import type { Order } from "./types";

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("8") && digits.length === 11 ? `7${digits.slice(1)}` : digits;
}

/** Canceled orders and failed/voided payment attempts do not consume a first-order offer. */
export function hasPreviousCustomerOrder(
  orders: Pick<Order, "status" | "payment" | "customer">[],
  identity: { phone?: string; email?: string },
): boolean {
  const phone = normalizedPhone(identity.phone ?? "");
  const email = identity.email?.trim().toLowerCase();
  if (!phone && !email) return false;

  return orders.some((order) => {
    if (order.status === "canceled" || order.payment?.status === "FAILED" || order.payment?.status === "VOIDED") {
      return false;
    }
    const samePhone = phone && normalizedPhone(order.customer.phone) === phone;
    const sameEmail = email && order.customer.email?.trim().toLowerCase() === email;
    return Boolean(samePhone || sameEmail);
  });
}

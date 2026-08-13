import { describe, expect, it } from "vitest";
import { buildCustomerPaymentLetter, customerEmailForOrder } from "./order-mail";
import type { Order } from "./types";

const paidOrder: Order = {
  id: "1308-001",
  createdAt: "2026-08-13T09:14:45.000Z",
  status: "new",
  customer: {
    name: "Иван Иванов",
    email: " Client@Example.COM ",
    phone: "+7 999 111-22-33",
    address: "ПВЗ Ozon",
  },
  items: [{ slug: "test-product", title: "Тестовый товар", price: 500, qty: 1 }],
  total: 800,
  paymentRequested: true,
  payment: {
    status: "CAPTURED",
    amount: 800,
    updatedAt: "2026-08-13T09:15:00.000Z",
    sandbox: false,
  },
};

describe("customer payment email", () => {
  it("sends the payment confirmation only to the normalized customer email", () => {
    expect(customerEmailForOrder(paidOrder)).toBe("client@example.com");

    const letter = buildCustomerPaymentLetter(paidOrder);
    expect(letter?.to).toEqual(["client@example.com"]);
    expect(letter?.subject).toContain("1308-001");
    expect(letter?.text).toContain("Фискальный чек должен прийти отдельным письмом");
  });

  it("does not enqueue an undeliverable letter when the order has no email", () => {
    const withoutEmail: Order = {
      ...paidOrder,
      customer: { ...paidOrder.customer, email: undefined },
    };
    expect(buildCustomerPaymentLetter(withoutEmail)).toBeNull();
  });

  it("shows spent bonuses in the customer confirmation", () => {
    const letter = buildCustomerPaymentLetter({
      ...paidOrder,
      bonus: { spent: 100, transactionId: "bonus-tx" },
    });
    expect(letter?.text).toContain("Использовано бонусов: 100");
    expect(letter?.html).toContain("Оплачено бонусами");
  });
});

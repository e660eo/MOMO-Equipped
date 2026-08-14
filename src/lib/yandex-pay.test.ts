import { describe, expect, it } from "vitest";
import { fiscalContact, isPaid, paymentDetailsFromResponse } from "./yandex-pay";

describe("payment status", () => {
  it("treats only captured money as paid", () => {
    expect(isPaid("CAPTURED")).toBe(true);
  });

  it.each(["none", "created", "PENDING", "AUTHORIZED", "FAILED", "VOIDED", "REFUNDED"] as const)(
    "does not treat %s as paid",
    (status) => expect(isPaid(status)).toBe(false),
  );
});

describe("fiscal receipt contact", () => {
  it("prefers the customer email so the receipt arrives in the inbox", () => {
    expect(fiscalContact(" Client@Example.COM ", "+7 999 111-22-33"))
      .toBe("client@example.com");
  });

  it("falls back to a normalized Russian phone for legacy orders", () => {
    expect(fiscalContact(undefined, "8 (999) 111-22-33"))
      .toBe("+79991112233");
  });
});

describe("payment and receipt details", () => {
  it("keeps the payment operation separate from the fiscal receipt number", () => {
    const details = paymentDetailsFromResponse({
      data: {
        operations: [{ operationId: "pay-operation-1", status: "SUCCESS", updated: "2026-08-14T10:00:00Z" }],
        order: {
          paymentStatus: "CAPTURED",
          fiscalContact: "buyer@example.com",
          cart: { items: [{ receipt: { tax: 8 } }, { receipt: { tax: 8 } }] },
        },
      },
    });
    expect(details).toMatchObject({
      status: "CAPTURED",
      fiscalContact: "buyer@example.com",
      receiptPayloadConfirmed: true,
      operationId: "pay-operation-1",
      operationStatus: "SUCCESS",
    });
  });
});

import { describe, expect, it } from "vitest";
import { fiscalContact, isPaid } from "./yandex-pay";

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

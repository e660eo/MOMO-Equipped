import { describe, expect, it } from "vitest";
import { isPaid } from "./yandex-pay";

describe("payment status", () => {
  it("treats only captured money as paid", () => {
    expect(isPaid("CAPTURED")).toBe(true);
  });

  it.each(["none", "created", "PENDING", "AUTHORIZED", "FAILED", "VOIDED", "REFUNDED"] as const)(
    "does not treat %s as paid",
    (status) => expect(isPaid(status)).toBe(false),
  );
});

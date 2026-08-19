import { describe, expect, it } from "vitest";
import { accountDestination, toPublicDealerSession } from "./viewer-session";
import type { DealerAccount, DealerLocation, PublicCustomer } from "./types";

describe("viewer session", () => {
  it("publishes only the dealer fields needed by the header", () => {
    const account = {
      contactName: "Алексей Иванов",
      passwordHash: "must-not-leak",
      email: "dealer@example.com",
    } as DealerAccount;
    const dealer = {
      name: "R2V",
      city: "Краснодар",
      phone: "+7 900 000-00-00",
    } as DealerLocation;

    expect(toPublicDealerSession({ account, dealer })).toEqual({
      contactName: "Алексей Иванов",
      company: "R2V",
      city: "Краснодар",
    });
  });

  it("opens the dealer cabinet when both account cookies exist", () => {
    const customer = { name: "Покупатель" } as PublicCustomer;
    const dealer = {
      contactName: "Алексей",
      company: "R2V",
      city: "Краснодар",
    };

    expect(accountDestination(customer, dealer)).toBe("/dealer");
    expect(accountDestination(customer, null)).toBe("/profile");
    expect(accountDestination(null, null)).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { mailerConfig, smtpSender } from "./mailer";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("smtpSender", () => {
  it("always uses the authenticated mailbox as the From address", () => {
    expect(smtpSender("mail@momo-eq.ru", "MOMO <other@example.com>")).toEqual({
      name: "MOMO",
      address: "mail@momo-eq.ru",
    });
  });

  it("accepts a plain display name", () => {
    expect(smtpSender("mail@momo-eq.ru", "Магазин MOMO")).toEqual({
      name: "Магазин MOMO",
      address: "mail@momo-eq.ru",
    });
  });
});

describe("mailerConfig", () => {
  it("does not let SMTP_FROM spoof another mailbox", () => {
    process.env.SMTP_USER = "mail@momo-eq.ru";
    process.env.SMTP_PASS = "test-secret";
    process.env.SMTP_FROM = "MOMO <other@example.com>";

    expect(mailerConfig()?.from).toEqual({
      name: "MOMO",
      address: "mail@momo-eq.ru",
    });
  });
});

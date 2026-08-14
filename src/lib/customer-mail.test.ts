import { describe, expect, it } from "vitest";
import { emailVerificationLetter, welcomeLetter } from "./customer-mail";

describe("welcomeLetter", () => {
  it("содержит оба логина и безопасную ссылку, но не обещает прислать пароль", () => {
    const letter = welcomeLetter({
      name: "Иван",
      email: "ivan@example.com",
      phone: "+7 999 123-45-67",
      resetLink: "https://momo-eq.ru/reset-password?token=safe",
    });
    expect(letter.text).toContain("ivan@example.com");
    expect(letter.text).toContain("+7 999 123-45-67");
    expect(letter.text).toContain("token=safe");
    expect(letter.text).toContain("Пароль в письме не отправляем");
  });

  it("экранирует имя в HTML", () => {
    const letter = welcomeLetter({
      name: "<Иван>",
      email: "ivan@example.com",
      phone: "+7 999 123-45-67",
      resetLink: "https://momo-eq.ru/reset-password?token=safe",
    });
    expect(letter.html).toContain("&lt;Иван&gt;");
    expect(letter.html).not.toContain("<Иван>");
  });
});

describe("emailVerificationLetter", () => {
  it("contains the signed verification link and no password", () => {
    const letter = emailVerificationLetter({
      name: "Иван",
      email: "ivan@example.com",
      verifyLink: "https://momo-eq.ru/verify-email?token=safe",
      welcome: true,
    });
    expect(letter.text).toContain("verify-email?token=safe");
    expect(letter.text).toContain("24 часа");
    expect(letter.text.toLowerCase()).not.toContain("ваш пароль:");
  });
});

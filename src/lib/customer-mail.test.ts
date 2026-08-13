import { describe, expect, it } from "vitest";
import { welcomeLetter } from "./customer-mail";

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

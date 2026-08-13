import { describe, expect, it } from "vitest";
import { formatPhone, phoneKey } from "./phone";

describe("phoneKey", () => {
  it.each([
    "+7 999 123-45-67",
    "8 999 123-45-67",
    "7 (999) 123-45-67",
    "9991234567",
  ])("приводит %s к одному ключу входа", (value) => {
    expect(phoneKey(value)).toBe("79991234567");
  });

  it("не принимает неполный номер", () => {
    expect(phoneKey("8 999 123-45")).toBe("");
  });

  it("правильно форматирует номер, введённый с 8", () => {
    expect(formatPhone("89991234567")).toBe("+7 999 123-45-67");
  });

  it("при начале ввода с 8 заменяет её на код +7", () => {
    expect(formatPhone("8")).toBe("+7 ");
  });
});

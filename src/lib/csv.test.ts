import { describe, expect, it } from "vitest";
import { csvField, neutralizeSpreadsheetFormula, parseCsv, toCsv } from "./csv";

describe("CSV export", () => {
  it.each([
    "=HYPERLINK(\"https://example.com\")",
    "+cmd|' /C calc'!A0",
    "-1+1",
    "@SUM(1,2)",
    "\t=1+1",
  ])("neutralises a spreadsheet formula: %s", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it("does not modify ordinary text or numeric values", () => {
    expect(csvField("MOMO Zeus")).toBe("MOMO Zeus");
    expect(csvField(12500)).toBe("12500");
  });

  it("keeps CSV quoting valid after neutralisation", () => {
    expect(csvField('=HYPERLINK("https://example.com")')).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
    expect(toCsv([["name", "note"], ["MOMO", "line 1\nline 2"]])).toBe(
      'name;note\r\nMOMO;"line 1\nline 2"',
    );
  });
});

describe("parseCsv", () => {
  it("reads semicolon CSV with quotes", () => {
    expect(parseCsv('slug;title;price\r\nfr-500;"FR; 500";4000\r\n')).toEqual([
      ["slug", "title", "price"],
      ["fr-500", "FR; 500", "4000"],
    ]);
  });

  it("removes the UTF-8 BOM", () => {
    expect(parseCsv("\uFEFFslug;stock\nfr-500;2")[0]).toEqual(["slug", "stock"]);
  });
});

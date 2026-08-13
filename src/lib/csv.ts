/*
  Мелкий помощник для выгрузки CSV.

  Разделитель — точка с запятой: Excel в русской локали именно так и делит
  столбцы, а запятая уезжала бы всё в одну колонку. Перевод строк — CRLF, как
  ждёт Excel. Файл потом отдаётся с BOM (﻿) в начале, иначе кириллица в
  Excel открывается кракозябрами.
*/

/** Экранирование одного поля: кавычки, «;» и переводы строк заворачиваем в кавычки. */
const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

/**
 * Neutralises values that spreadsheet applications could execute as formulas.
 * The leading apostrophe is the standard Excel/LibreOffice text marker.
 */
export function neutralizeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function csvField(value: string | number | undefined | null): string {
  const raw = value == null ? "" : String(value);
  const s = typeof value === "string" ? neutralizeSpreadsheetFormula(raw) : raw;
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: (string | number | undefined | null)[][],
): string {
  return rows.map((r) => r.map(csvField).join(";")).join("\r\n");
}

/** Небольшой RFC-совместимый разборщик CSV с ;, кавычками и переносами строк. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ";") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim()));
}

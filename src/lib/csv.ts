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

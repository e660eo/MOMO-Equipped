import { unzipSync, zipSync } from "fflate";

export const MAX_DEALER_WORKBOOK_SOURCE_BYTES = 150 * 1024 * 1024;
export const MAX_DEALER_WORKBOOK_BYTES = 8 * 1024 * 1024;
export const MAX_DEALER_WORKBOOK_XML_BYTES = 16 * 1024 * 1024;

/** Retain spreadsheet values and relationships; embedded product photos never leave the browser. */
export function isDealerWorkbookPart(name: string): boolean {
  return /^(?:\[Content_Types\]\.xml|_rels\/\.rels|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml))$/.test(name);
}

export function compactDealerWorkbook(input: Uint8Array): Uint8Array {
  if (!input.length || input.length > MAX_DEALER_WORKBOOK_SOURCE_BYTES) {
    throw new Error("Размер исходного Excel должен быть не больше 150 МБ.");
  }
  let total = 0;
  let entries = 0;
  const parts = unzipSync(input, { filter(entry) {
    if (++entries > 2_000) throw new Error("В Excel слишком много вложенных файлов.");
    if (!isDealerWorkbookPart(entry.name)) return false;
    total += entry.originalSize;
    if (entry.originalSize > 4 * 1024 * 1024 || total > MAX_DEALER_WORKBOOK_XML_BYTES) {
      throw new Error("Таблицы Excel слишком большие. Оставьте в файле только прайс.");
    }
    return true;
  } });
  if (!parts["xl/workbook.xml"] || !parts["[Content_Types].xml"]) {
    throw new Error("Нужен файл Excel в формате .xlsx.");
  }
  const compact = zipSync(parts, { level: 6 });
  if (compact.length > MAX_DEALER_WORKBOOK_BYTES) throw new Error("Таблицы Excel должны занимать не больше 8 МБ.");
  return compact;
}

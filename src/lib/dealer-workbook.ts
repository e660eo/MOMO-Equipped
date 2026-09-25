import { fromBuffer } from "yauzl";
import readXlsxFile from "read-excel-file/node";
import { MAX_DEALER_WORKBOOK_BYTES, MAX_DEALER_WORKBOOK_XML_BYTES, isDealerWorkbookPart } from "./dealer-workbook-compact";
import { ExpectedError } from "./errors";

export interface DealerWorkbookRow {
  sheet: string;
  row: number;
  model: string;
  description: string;
  sourcePrice: number | null;
}

export interface DealerWorkbookData {
  rows: DealerWorkbookRow[];
  errors: string[];
}

export function normalizeDealerSource(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

/** Stream all ZIP entries before parsing: limits apply to actual bytes, not just ZIP metadata. */
export async function validateDealerWorkbookArchive(input: Buffer): Promise<void> {
  if (!input.length || input.length > MAX_DEALER_WORKBOOK_BYTES) throw new ExpectedError("Таблицы Excel должны занимать не больше 8 МБ.");
  await new Promise<void>((resolve, reject) => {
    fromBuffer(input, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) { reject(new ExpectedError("Не удалось открыть Excel. Сохраните прайс в формате .xlsx.")); return; }
      let total = 0;
      let entries = 0;
      let done = false;
      const names = new Set<string>();
      const fail = (message: string) => {
        if (done) return;
        done = true;
        zip.close();
        reject(new ExpectedError(message));
      };
      zip.on("error", () => fail("Архив Excel повреждён или имеет неподдерживаемый формат."));
      zip.on("entry", (entry) => {
        if (++entries > 100 || names.has(entry.fileName) || !isDealerWorkbookPart(entry.fileName) || entry.isEncrypted()) {
          fail("Excel содержит неподдерживаемые или повторяющиеся части. Загрузите файл через форму ещё раз."); return;
        }
        names.add(entry.fileName);
        if (entry.uncompressedSize > 4 * 1024 * 1024 || total + entry.uncompressedSize > MAX_DEALER_WORKBOOK_XML_BYTES) {
          fail("Таблицы Excel слишком большие. Оставьте в файле только прайс."); return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail("Не удалось прочитать таблицы Excel."); return; }
          const chunks: Buffer[] = [];
          stream.on("error", () => fail("Размер содержимого Excel не совпадает с данными архива."));
          stream.on("data", (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_DEALER_WORKBOOK_XML_BYTES) { stream.destroy(); fail("Распакованный Excel слишком большой."); return; }
            chunks.push(chunk);
          });
          stream.on("end", () => {
            if (done) return;
            const xml = Buffer.concat(chunks).toString("utf8");
            if (/<!DOCTYPE|<!ENTITY/i.test(xml)) { fail("Excel содержит неподдерживаемые XML-объявления."); return; }
            // Prevent sparse worksheet coordinates from allocating huge arrays in an XLSX reader.
            if (/^xl\/worksheets\//.test(entry.fileName)) {
              for (const match of xml.matchAll(/\b(?:r|ref)\s*=\s*["']([A-Z]+)([0-9]+)(?::([A-Z]+)([0-9]+))?["']/g)) {
                const lastColumn = match[3] || match[1];
                const column = [...lastColumn].reduce((n, character) => n * 26 + character.charCodeAt(0) - 64, 0);
                if (Number(match[4] || match[2]) > 5_000 || column > 100) { fail("В прайсе допускается до 5000 строк и 100 столбцов на лист."); return; }
              }
            }
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => {
        if (done) return;
        if (!names.has("xl/workbook.xml") || !names.has("[Content_Types].xml")) { fail("В файле не найдена книга Excel."); return; }
        done = true;
        resolve();
      });
      zip.readEntry();
    });
  });
}

export async function readDealerWorkbook(input: Buffer): Promise<DealerWorkbookData> {
  await validateDealerWorkbookArchive(input);
  let sheets;
  try { sheets = await readXlsxFile(input); } catch { throw new ExpectedError("Не удалось прочитать прайс. Пересохраните его в Excel в формате .xlsx и повторите загрузку."); }
  if (sheets.length > 30) throw new ExpectedError("В прайсе допускается не больше 30 листов.");
  const rows: DealerWorkbookRow[] = [];
  const errors: string[] = [];
  for (const sheet of sheets) {
    const headerIndex = sheet.data.slice(0, 10).findIndex((row) => row.some((cell) => typeof cell === "string" && normalizeDealerSource(cell) === "модель"));
    if (headerIndex < 0) { errors.push(`Лист «${sheet.sheet}»: не найден заголовок «Модель» в первых 10 строках.`); continue; }
    const headers = sheet.data[headerIndex].map((cell) => typeof cell === "string" ? normalizeDealerSource(cell) : "");
    const modelColumn = headers.indexOf("модель");
    const priceColumn = headers.indexOf("дил. цена");
    const descriptionColumn = headers.indexOf("описание");
    if (priceColumn < 0 || descriptionColumn < 0 || ["модель", "дил. цена", "описание"].some((name) => headers.filter((v) => v === name).length !== 1)) {
      errors.push(`Лист «${sheet.sheet}»: нужны однозначные столбцы «Модель», «Дил. цена» и «Описание».`); continue;
    }
    sheet.data.slice(headerIndex + 1).forEach((cells, index) => {
      const model = String(cells[modelColumn] ?? "").trim();
      const price = cells[priceColumn];
      const description = String(cells[descriptionColumn] ?? "").trim();
      if (!model) return;
      if (model.length > 500 || description.length > 12_000) { errors.push(`Лист «${sheet.sheet}», строка ${headerIndex + index + 2}: слишком длинное описание.`); return; }
      // Formula values are read from Excel's saved numeric results; formulas never execute here.
      rows.push({ sheet: sheet.sheet, row: headerIndex + index + 2, model, description, sourcePrice: typeof price === "number" && Number.isFinite(price) && price > 0 && price <= 100_000_000 ? price : null });
    });
  }
  if (!rows.length) throw new ExpectedError("В Excel не найдены товары. Используйте прайс со столбцами «Модель», «Дил. цена» и «Описание».");
  return { rows, errors };
}

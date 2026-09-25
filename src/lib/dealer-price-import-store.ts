import { readJson, updateJson, writeJson, assertWritable } from "./store";
import { getB2BPriceBook } from "./b2b-prices";
import { getAllProducts } from "./data";
import { withDataFileLock } from "./data-file-lock";
import { ExpectedError } from "./errors";
import { dealerPriceFingerprint, type DealerPriceImportPreview } from "./dealer-price-import";

const PREVIEWS_FILE = "dealer-price-import-previews.json";
const PRICE_FILE = "b2b-prices.json";
const MAX_AGE_MS = 30 * 60 * 1000;

export function saveDealerPriceImportPreview(preview: DealerPriceImportPreview): void {
  assertWritable();
  withDataFileLock(PREVIEWS_FILE, () => updateJson<DealerPriceImportPreview[]>(PREVIEWS_FILE, (current) => {
    const active = (Array.isArray(current) ? current : []).filter((item) => Date.now() - Date.parse(item.createdAt) < MAX_AGE_MS);
    return [preview, ...active].slice(0, 10);
  }));
}

export function applyDealerPriceImport(previewId: string): number {
  assertWritable();
  return withDataFileLock(PRICE_FILE, () => {
    let previews: DealerPriceImportPreview[];
    try { previews = readJson<DealerPriceImportPreview[]>(PREVIEWS_FILE); } catch { previews = []; }
    const preview = (Array.isArray(previews) ? previews : []).find((item) => item.id === previewId);
    if (!preview || Date.now() - Date.parse(preview.createdAt) > MAX_AGE_MS) throw new ExpectedError("Предпросмотр истёк. Загрузите Excel ещё раз, чтобы проверить актуальные изменения.");
    if (preview.conflicts.length) throw new ExpectedError("В прайсе есть ошибки. Исправьте их в Excel и загрузите файл ещё раз.");
    if (dealerPriceFingerprint(getB2BPriceBook()) !== preview.baseFingerprint || dealerPriceFingerprint(getAllProducts()) !== preview.catalogFingerprint) {
      throw new ExpectedError("Прайс или каталог уже изменился после предпросмотра. Загрузите Excel ещё раз и проверьте новые изменения.");
    }
    const next = { ...preview.nextBook, updatedAt: new Date().toISOString() };
    writeJson(PRICE_FILE, next);
    // A repeated confirmation is rejected by the changed book fingerprint.
    return Object.keys(next.prices).length;
  });
}

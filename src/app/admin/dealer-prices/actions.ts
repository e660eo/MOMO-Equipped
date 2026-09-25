"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/data";
import { getB2BPriceBook } from "@/lib/b2b-prices";
import { readDealerWorkbook } from "@/lib/dealer-workbook";
import { MAX_DEALER_WORKBOOK_BYTES } from "@/lib/dealer-workbook-compact";
import { buildDealerPriceImport, dealerPriceImportView, type DealerPriceImportView } from "@/lib/dealer-price-import";
import { applyDealerPriceImport, saveDealerPriceImportPreview } from "@/lib/dealer-price-import-store";
import { ExpectedError, messageFor } from "@/lib/errors";
import { audit } from "@/lib/audit-log";

export interface DealerPriceUploadState { error?: string; preview?: DealerPriceImportView }
export interface DealerPriceApplyState { error?: string; count?: number }

export async function previewDealerPriceUpload(_state: DealerPriceUploadState, form: FormData): Promise<DealerPriceUploadState> {
  await requireSession();
  try {
    const file = form.get("workbook");
    if (!(file instanceof File) || !/\.xlsx$/i.test(file.name)) throw new ExpectedError("Выберите прайс в формате .xlsx.");
    if (!file.size || file.size > MAX_DEALER_WORKBOOK_BYTES) throw new ExpectedError("Таблицы прайса должны занимать не больше 8 МБ. Загрузите Excel через форму ещё раз.");
    const fileName = file.name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180);
    const workbook = await readDealerWorkbook(Buffer.from(await file.arrayBuffer()));
    const preview = buildDealerPriceImport(workbook, getAllProducts(), getB2BPriceBook(), fileName);
    saveDealerPriceImportPreview(preview);
    return { preview: dealerPriceImportView(preview) };
  } catch (error) {
    return { error: messageFor(error, "Не удалось подготовить прайс. Попробуйте загрузить файл ещё раз.", "dealer price preview") };
  }
}

export async function confirmDealerPriceUpload(_state: DealerPriceApplyState, form: FormData): Promise<DealerPriceApplyState> {
  await requireSession();
  try {
    if (form.get("confirmed") !== "yes") throw new ExpectedError("Проверьте изменения и подтвердите замену дилерского прайса.");
    const id = String(form.get("previewId") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ExpectedError("Предпросмотр не найден. Загрузите Excel ещё раз.");
    const count = applyDealerPriceImport(id);
    try { audit({ entity: "dealer", entityId: "price-book", action: "price-import", summary: `Обновлён единый дилерский прайс: ${count} позиций`, after: { previewId: id, count } }); }
    catch (error) { console.error("dealer price import audit:", error); }
    revalidatePath("/admin/dealers");
    revalidatePath("/admin/dealer-prices");
    revalidatePath("/dealer", "layout");
    return { count };
  } catch (error) {
    return { error: messageFor(error, "Не удалось применить прайс. Обновите страницу и проверьте текущие цены.", "dealer price apply") };
  }
}

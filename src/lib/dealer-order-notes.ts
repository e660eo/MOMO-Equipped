import { withDataFileLock } from "./data-file-lock";
import { getDealerOrders } from "./dealers";
import { ExpectedError } from "./errors";
import { assertWritable, readJson, writeJson } from "./store";

const FILE = "dealer-order-notes.json";
export interface DealerOrderNote { orderId: string; revision: number; note: string; followUpDate: string; updatedAt: string }
export function getDealerOrderNotes(): DealerOrderNote[] {
  try { return readJson<DealerOrderNote[]>(FILE); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export function saveDealerOrderNote(orderId: string, revision: number, note: string, followUpDate: string): DealerOrderNote {
  assertWritable();
  if (!getDealerOrders().some((order) => order.id === orderId)) throw new ExpectedError("Заказ не найден.");
  if (note.length > 5000 || !Number.isSafeInteger(revision) || revision < 0) throw new ExpectedError("Проверьте заметку и обновите страницу.");
  if (followUpDate && (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate) || !Number.isFinite(Date.parse(followUpDate)) || new Date(followUpDate).toISOString().slice(0, 10) !== followUpDate)) throw new ExpectedError("Проверьте дату следующего контакта.");
  return withDataFileLock(FILE, () => {
    const all = getDealerOrderNotes();
    if ((all.find((item) => item.orderId === orderId)?.revision ?? 0) !== revision) throw new ExpectedError("Заметка уже изменена в другом окне. Обновите страницу.");
    const saved = { orderId, revision: revision + 1, note: note.trim(), followUpDate, updatedAt: new Date().toISOString() };
    writeJson(FILE, [...all.filter((item) => item.orderId !== orderId), saved]);
    return saved;
  });
}

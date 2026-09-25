import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ExpectedError } from "./errors";
import { assertWritable, dataDir } from "./store";

const MAX_SIZE = 5 * 1024 * 1024;
export interface DealerInvoiceFile {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

function invoicePath(id: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error("Invalid invoice id");
  return path.join(dataDir(), "dealer-invoices", `${id}.pdf`);
}

export async function saveDealerInvoice(file: File): Promise<DealerInvoiceFile> {
  assertWritable();
  if (file.size < 5 || file.size > MAX_SIZE) throw new ExpectedError("Счёт должен быть PDF-файлом размером не более 5 МБ.");
  const originalName = path.basename(file.name.replaceAll("\\", "/")).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180);
  if (!/\.pdf$/i.test(originalName)) throw new ExpectedError("Загрузите счёт в формате PDF.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new ExpectedError("Файл не является PDF. Проверьте выбранный счёт.");
  const invoice: DealerInvoiceFile = { id: crypto.randomUUID(), originalName, size: buffer.length, uploadedAt: new Date().toISOString() };
  const target = invoicePath(invoice.id);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, buffer, { flag: "wx", mode: 0o600 });
  return invoice;
}

export function readDealerInvoice(invoice: DealerInvoiceFile): Buffer {
  return fs.readFileSync(invoicePath(invoice.id));
}

/** Used only for a newly uploaded file when its agreement could not be saved. */
export function discardUnsavedDealerInvoice(invoice: DealerInvoiceFile): void {
  fs.rmSync(invoicePath(invoice.id), { force: true });
}

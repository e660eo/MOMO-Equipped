import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ExpectedError } from "./errors";
import { dataDir, uploadsDir } from "./store";

const MAX_BYTES = 18 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["application/zip", ".zip"],
  ["application/x-zip-compressed", ".zip"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function privateFilesDir(): string {
  return path.join(dataDir(), "dealer-files");
}

function supportDir(audience: "public" | "dealer"): string {
  return audience === "dealer" ? privateFilesDir() : uploadsDir();
}

export async function saveSupportFile(file: File, audience: "public" | "dealer"): Promise<string> {
  const extension = ALLOWED.get(file.type);
  if (!extension) throw new ExpectedError("Поддерживаются PDF, ZIP, DOCX, XLSX, JPG, PNG и WEBP.");
  if (file.size <= 0) throw new ExpectedError("Выберите файл.");
  if (file.size > MAX_BYTES) throw new ExpectedError("Файл больше 18 МБ — уменьшите его или разделите архив.");
  const dir = supportDir(audience);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `support-${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function deleteSupportFile(name: string, audience: "public" | "dealer"): Promise<void> {
  if (!/^support-[a-f0-9-]+\.(pdf|zip|docx|xlsx|jpg|png|webp)$/i.test(name)) return;
  await fs.promises.rm(path.join(supportDir(audience), name), { force: true });
}

export function supportFilePath(name: string, audience: "public" | "dealer"): string | null {
  if (!/^support-[a-f0-9-]+\.(pdf|zip|docx|xlsx|jpg|png|webp)$/i.test(name)) return null;
  return path.join(supportDir(audience), name);
}

export function supportFileMime(name: string): string {
  const extension = path.extname(name).toLowerCase();
  return [...ALLOWED.entries()].find(([, value]) => value === extension)?.[0] ?? "application/octet-stream";
}

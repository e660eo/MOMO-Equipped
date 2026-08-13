import crypto from "node:crypto";
import { assertWritable, readJson, updateJson } from "./store";
import { deleteSupportFile } from "./support-files";
import type { SupportDocument } from "./types";

const FILE = "support-documents.json";

export function getSupportDocuments(audience?: "public" | "dealer"): SupportDocument[] {
  const all = readJson<SupportDocument[]>(FILE);
  return all
    .filter((document) => !audience || document.audience === "public" || document.audience === audience)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addSupportDocument(
  input: Omit<SupportDocument, "id" | "createdAt">,
): SupportDocument {
  assertWritable();
  const document: SupportDocument = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  updateJson<SupportDocument[]>(FILE, (all) => [document, ...all]);
  return document;
}

export async function removeSupportDocument(id: string): Promise<void> {
  assertWritable();
  const document = readJson<SupportDocument[]>(FILE).find((item) => item.id === id);
  if (!document) return;
  updateJson<SupportDocument[]>(FILE, (all) => all.filter((item) => item.id !== id));
  await deleteSupportFile(document.file, document.audience);
}

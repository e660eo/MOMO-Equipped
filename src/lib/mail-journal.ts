import crypto from "node:crypto";
import { withDataFileLock } from "./data-file-lock";
import { assertWritable, readJson, writeJson } from "./store";
const FILE = "mail-journal.json";
export interface MailJournalEntry { id: string; at: string; subject: string; to: string[]; status: "accepted" | "failed"; error?: string }
export function getMailJournal(): MailJournalEntry[] {
  try { return readJson<MailJournalEntry[]>(FILE); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
/** Store metadata only: never persist letter bodies, activation links or login codes. */
export function recordMailAttempt(input: Omit<MailJournalEntry, "id">): void {
  try {
    assertWritable();
    withDataFileLock(FILE, () => writeJson(FILE, [{ ...input, id: crypto.randomUUID(), subject: input.subject.slice(0, 300), error: input.error?.slice(0, 1200) }, ...getMailJournal()].slice(0, 2000)));
  } catch (error) { console.error("[mail-journal] Could not save delivery metadata", error); }
}

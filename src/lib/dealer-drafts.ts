import { assertWritable, readJson, updateJson } from "./store";
import { withDataFileLock } from "./data-file-lock";
import { applyDealerDraftMutation, emptyDealerDraft, type DealerDraftMutation, type SyncedDealerDraft } from "./dealer-order-draft";

const FILE = "dealer-drafts.json";
type SavedDraft = { accountId: string; draft: SyncedDealerDraft };
function drafts(): SavedDraft[] {
  try { return readJson<SavedDraft[]>(FILE); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export function getDealerDraft(accountId: string): SyncedDealerDraft {
  return drafts().find((entry) => entry.accountId === accountId)?.draft ?? emptyDealerDraft();
}
export function changeDealerDraft(accountId: string, mutation: DealerDraftMutation): SyncedDealerDraft {
  assertWritable();
  return withDataFileLock(FILE, () => {
    drafts(); // Never overwrite an unreadable file with an empty collection.
    const saved = updateJson<SavedDraft[]>(FILE, (all) => {
      const current = all.find((entry) => entry.accountId === accountId)?.draft ?? emptyDealerDraft();
      if (current.applied.includes(mutation.id)) return all;
      const draft = applyDealerDraftMutation(current, mutation);
      if (Object.keys(draft.quantities).length > 500) throw new Error("В заявке может быть не больше 500 позиций.");
      draft.updatedAt = new Date().toISOString();
      return [...all.filter((entry) => entry.accountId !== accountId), { accountId, draft }];
    });
    return saved.find((entry) => entry.accountId === accountId)!.draft;
  });
}

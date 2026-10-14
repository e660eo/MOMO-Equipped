import fs from "node:fs";
import path from "node:path";
import { dataDir, readJson, updateJson, withStoreTransaction } from "./store";
import { pruneOldOrders } from "./orders";
import type { SupportConversation } from "./types";

const DAY = 24 * 60 * 60 * 1000;

/** Не затрагивает старые обращения без установленного срока и открытые претензии. */
export function pruneClosedSupport(now = Date.now()): number {
  return withStoreTransaction(() => {
    let all: SupportConversation[];
    try { all = readJson<SupportConversation[]>("support-conversations.json"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    const kept = all.filter((item) => item.status !== "closed" ||
      item.consent?.purpose !== "support" ||
      !Number.isFinite(Date.parse(item.updatedAt)) ||
      Date.parse(item.updatedAt) > now - 365 * DAY);
    if (kept.length !== all.length) updateJson("support-conversations.json", () => kept);
    return all.length - kept.length;
  });
}

/** Только известные форматы резервных файлов, без перехода по ссылкам и удаления папок. */
export function pruneExpiredBackups(now = Date.now()): number {
  const root = path.resolve(dataDir());
  const directory = path.join(root, "backups");
  if (!fs.existsSync(directory)) return 0;
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("Backup directory must not be a symlink");
  const canonicalRoot = fs.realpathSync(root);
  if (path.dirname(fs.realpathSync(directory)) !== canonicalRoot) throw new Error("Backup directory outside data root");
  let removed = 0;
  for (const name of fs.readdirSync(directory)) {
    if (!/^[a-z0-9][a-z0-9._-]*\.json\.\d{4}-\d{2}-\d{2}T[\d-]+Z$/i.test(name) &&
        !/^momo-data-\d{4}-\d{2}-\d{2}[\d_-]*\.tar\.gz$/.test(name)) continue;
    const target = path.resolve(directory, name);
    if (path.dirname(target) !== directory) continue;
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.mtimeMs > now - 28 * DAY) continue;
    fs.unlinkSync(target);
    removed += 1;
  }
  return removed;
}

export function runPrivacyMaintenance(): void {
  for (const [name, operation] of [
    ["orders", pruneOldOrders],
    ["support", pruneClosedSupport],
    ["backups", pruneExpiredBackups],
  ] as const) {
    try {
      const count = operation();
      if (count) console.info(`[privacy] ${name}: removed ${count}`);
    } catch (error) { console.error(`[privacy] ${name}: maintenance failed`, error); }
  }
}

let started = false;
export function schedulePrivacyMaintenance(): void {
  if (started) return;
  started = true;
  setTimeout(runPrivacyMaintenance, 60_000).unref?.();
  setInterval(runPrivacyMaintenance, DAY).unref?.();
}

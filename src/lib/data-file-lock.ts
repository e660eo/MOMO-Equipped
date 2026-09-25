import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./store-paths";
import { ExpectedError } from "./errors";

/** Short synchronous transactions shared by Next workers and rolling releases. */
export function withDataFileLock<T>(file: string, operation: () => T): T {
  if (!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(file)) throw new Error("Invalid data file lock");
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, `${file}.lock`);
  const started = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Operations under the lock must not await network or other asynchronous IO.
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 120_000) {
          fs.rmdirSync(lock);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }
      if (Date.now() - started > 2_000) throw new ExpectedError("Данные сейчас обновляются. Повторите попытку через несколько секунд.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try { return operation(); }
  finally { fs.rmdirSync(lock); }
}

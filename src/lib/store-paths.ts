import path from "node:path";

export const SEED_DIR = path.join(process.cwd(), "data");

export function dataDir(): string {
  return process.env.MOMO_DATA_DIR?.trim() || SEED_DIR;
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

export function seedUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export function isRepoData(): boolean {
  return path.resolve(dataDir()) === path.resolve(SEED_DIR);
}

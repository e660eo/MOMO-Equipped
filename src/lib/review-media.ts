import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ExpectedError } from "./errors";
import { uploadsDir } from "./store";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REVIEW_PHOTO = /^review-[a-f0-9-]+\.webp$/i;

/** Проверяет, сжимает и сохраняет единственную фотографию к отзыву. */
export async function saveReviewPhoto(file: File): Promise<string> {
  if (!file.size) throw new ExpectedError("Выберите фотографию.");
  if (!IMAGE_TYPES.has(file.type)) {
    throw new ExpectedError("Поддерживаются фотографии JPG, PNG и WEBP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ExpectedError("Фотография больше 10 МБ — уменьшите размер файла.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    throw new ExpectedError("Не получилось обработать файл — похоже, это не фотография.");
  }

  const name = `review-${crypto.randomUUID()}.webp`;
  const dir = uploadsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), output);
  return name;
}

export async function deleteReviewPhoto(name: string): Promise<void> {
  if (!REVIEW_PHOTO.test(name)) return;
  await fs.promises.rm(path.join(uploadsDir(), name), { force: true });
}

export function deleteReviewPhotoSync(name: string): void {
  if (!REVIEW_PHOTO.test(name)) return;
  fs.rmSync(path.join(uploadsDir(), name), { force: true });
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ExpectedError } from "./errors";
import { uploadsDir } from "./store";
import type { BannerMediaType } from "./types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_EXTENSIONS = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
]);

export interface SavedBannerMedia {
  file: string;
  type: BannerMediaType;
  originalName: string;
  width?: number;
  height?: number;
}

export async function getBannerImageDimensions(
  name: string,
): Promise<{ width: number; height: number } | undefined> {
  if (!/^[a-z0-9._-]+\.(avif|jpe?g|png|webp)$/i.test(name)) return undefined;
  try {
    const metadata = await sharp(path.join(uploadsDir(), name)).metadata();
    if (!metadata.width || !metadata.height) return undefined;
    return { width: metadata.width, height: metadata.height };
  } catch {
    return undefined;
  }
}

function looksLikeMp4(input: Buffer): boolean {
  return input.length >= 12 && input.subarray(4, 8).toString("ascii") === "ftyp";
}

function looksLikeWebm(input: Buffer): boolean {
  return (
    input.length >= 4 &&
    input[0] === 0x1a &&
    input[1] === 0x45 &&
    input[2] === 0xdf &&
    input[3] === 0xa3
  );
}

export async function saveBannerMedia(file: File): Promise<SavedBannerMedia> {
  if (!file.size) throw new ExpectedError("Выберите фото или видео.");
  const isImage = IMAGE_TYPES.has(file.type);
  const extension = VIDEO_EXTENSIONS.get(file.type);
  if (!isImage && !extension) {
    throw new ExpectedError("Поддерживаются JPG, PNG, WEBP, MP4 и WEBM.");
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new ExpectedError("Фото больше 20 МБ — уменьшите размер файла.");
  }
  if (extension && file.size > MAX_VIDEO_BYTES) {
    throw new ExpectedError("Видео больше 50 МБ — сожмите ролик перед загрузкой.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const dir = uploadsDir();

  if (isImage) {
    let output: Buffer;
    let width: number;
    let height: number;
    try {
      const result = await sharp(input)
        .rotate()
        .resize(2400, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
      output = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new ExpectedError("Не получилось обработать файл — похоже, это не фото.");
    }
    const name = `banner-${crypto.randomUUID()}.webp`;
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, name), output);
    return {
      file: name,
      type: "image",
      originalName: file.name.slice(0, 200),
      width,
      height,
    };
  }

  if (
    (extension === ".mp4" && !looksLikeMp4(input)) ||
    (extension === ".webm" && !looksLikeWebm(input))
  ) {
    throw new ExpectedError("Файл не похож на исправное видео MP4 или WEBM.");
  }

  const name = `banner-${crypto.randomUUID()}${extension}`;
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), input);
  return { file: name, type: "video", originalName: file.name.slice(0, 200) };
}

export async function deleteBannerMedia(name: string): Promise<void> {
  if (!/^banner-[a-f0-9-]+\.(webp|mp4|webm)$/i.test(name)) return;
  await fs.promises.rm(path.join(uploadsDir(), name), { force: true });
}

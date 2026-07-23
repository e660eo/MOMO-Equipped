import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { uploadsDir } from "./store";
import { ExpectedError } from "./errors";

/*
  Обработка загружаемых фото товара.

  Конвейер тот же, которым прогнаны нынешние снимки каталога: обрезать
  однотонные поля по краям, вписать в квадрат 900×900 и сжать в webp. Так
  новые карточки не выбиваются из ряда — фон и масштаб совпадают.
*/

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Отказ, написанный для владельца магазина: показывается ему как есть. */
export class ImageError extends ExpectedError {}

/**
 * Сохраняет загруженный файл в папку данных и возвращает имя, которое
 * нужно записать в товар.
 */
export async function saveProductImage(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new ImageError(
      "Поддерживаются JPG, PNG и WEBP. Если фото с айфона в формате HEIC — " +
        "сохраните его как JPG и загрузите заново.",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError("Файл больше 15 МБ — уменьшите размер снимка.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(input)
      // trim срезает одноцветную рамку вокруг товара: на прайсовых снимках
      // её бывает половина кадра. Порог 12 — эмпирический, при меньшем
      // съедало тени, при большем оставались поля.
      .trim({ threshold: 12 })
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageError("Не получилось обработать файл — похоже, это не фото.");
  }

  const dir = uploadsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.webp`;
  await fs.promises.writeFile(path.join(dir, name), output);
  return name;
}

/**
 * Удаляет файл фото. Молча пропускает отсутствующий: карточку могли
 * пересохранить дважды, и второй заход уже ничего не найдёт.
 */
export async function deleteProductImage(name: string): Promise<void> {
  if (!name || name.includes("/") || name.includes("\\")) return;
  await fs.promises.rm(path.join(uploadsDir(), name), { force: true });
}

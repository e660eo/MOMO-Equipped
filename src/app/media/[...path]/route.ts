import fs from "node:fs";
import path from "node:path";
import { uploadsDir, seedUploadsDir } from "@/lib/store";

/*
  Отдача фото товаров.

  Файлы лежат в папке данных вне репозитория (иначе выкат затирал бы всё
  загруженное через админку), поэтому обычной раздачей из public/ обойтись
  нельзя. Имена файлов уникальны и никогда не переиспользуются — отсюда
  годовой immutable-кэш.
*/

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;

  const type = TYPES[path.extname(parts.at(-1) ?? "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  // Сначала загруженные через админку, затем исходные снимки каталога,
  // приехавшие вместе с кодом.
  let file: Buffer | null = null;
  for (const dir of [uploadsDir(), seedUploadsDir()]) {
    // Проверяем, что склеенный путь не выпрыгнул из папки: «..» в адресе
    // иначе увёл бы к любому файлу на сервере.
    const target = path.resolve(dir, ...parts);
    if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
    try {
      file = await fs.promises.readFile(target);
      break;
    } catch {
      // пробуем следующую папку
    }
  }
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(file.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

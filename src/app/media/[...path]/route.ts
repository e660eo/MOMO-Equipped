import fs from "node:fs";
import path from "node:path";
import { uploadsDir, seedUploadsDir } from "@/lib/store-paths";

/*
  Отдача фото товаров.

  Файлы лежат в папке данных вне репозитория (иначе выкат затирал бы всё
  загруженное через админку), поэтому обычной раздачей из public/ обойтись
  нельзя. Имена файлов уникальны и никогда не переиспользуются — отсюда
  годовой immutable-кэш.
*/

/*
  SVG в списке намеренно нет. Он отдаётся как размеченный документ и умеет
  выполнять скрипты со своего адреса — то есть с нашего домена. Загрузка
  фото пропускает всё через sharp и кладёт только webp, так что положить
  сюда SVG сейчас неоткуда, но и строчки на этот случай быть не должно.
*/
const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);

function requestedRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;

  const extension = path.extname(parts.at(-1) ?? "").toLowerCase();
  const type = TYPES[extension];
  if (!type) return new Response("Not found", { status: 404 });

  // Сначала загруженные через админку, затем исходные снимки каталога,
  // приехавшие вместе с кодом.
  let targetFile: string | null = null;
  for (const dir of [uploadsDir(), seedUploadsDir()]) {
    // Проверяем, что склеенный путь не выпрыгнул из папки: «..» в адресе
    // иначе увёл бы к любому файлу на сервере.
    const target = path.resolve(dir, ...parts);
    if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
    try {
      const info = await fs.promises.stat(target);
      if (!info.isFile()) continue;
      targetFile = target;
      break;
    } catch {
      // пробуем следующую папку
    }
  }
  if (!targetFile) return new Response("Not found", { status: 404 });

  const size = (await fs.promises.stat(targetFile)).size;
  const rangeHeader = AUDIO_EXTENSIONS.has(extension) ? req.headers.get("range") : null;
  const range = requestedRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const length = end - start + 1;
  const file = Buffer.alloc(length);
  const handle = await fs.promises.open(targetFile, "r");
  try {
    await handle.read(file, 0, length, start);
  } finally {
    await handle.close();
  }

  return new Response(new Uint8Array(file), {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(length),
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(AUDIO_EXTENSIONS.has(extension) ? { "Accept-Ranges": "bytes" } : {}),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}

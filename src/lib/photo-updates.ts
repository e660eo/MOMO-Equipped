import fs from "node:fs";
import path from "node:path";
import { readJson, updateJson, seedUploadsDir, uploadsDir } from "./store";
import type { Product } from "./types";
import updates from "./photo-updates.json";

/*
  Одноразовая миграция фото товаров.

  Живые данные каталога лежат вне репозитория (см. store.ts), поэтому
  новые снимки нельзя «доставить» просто git-выкатом: файлы уезжают в
  public/uploads и отдаются роутом /media, но поле `image`/`images` товара
  правится только в папке данных на сервере. Эта миграция и правит его —
  на старте процесса, там же, где данные лежат. По образцу title-cleanup:
  самоограничивается (пишет, только пока есть что менять) и не роняет старт.

  Список правок — в photo-updates.json (слаг → обложка + галерея). Файлы
  снимков приезжают в public/uploads тем же коммитом.
*/

type Update = { image: string; images?: string[] };
const MAP = updates as Record<string, Update>;

/** Снимок доступен роуту /media: либо загружен в панели, либо приехал с кодом. */
function fileExists(name: string): boolean {
  return (
    fs.existsSync(path.join(uploadsDir(), name)) ||
    fs.existsSync(path.join(seedUploadsDir(), name))
  );
}

/** Целевые обложка и галерея товара — с отсевом снимков, которых нет на диске. */
function target(u: Update): { image: string; gallery: string[] } | null {
  if (!fileExists(u.image)) return null; // на отсутствующий файл не указываем
  return { image: u.image, gallery: (u.images ?? []).filter(fileExists) };
}

function needsChange(p: Product): boolean {
  const u = MAP[p.slug];
  if (!u) return false;
  const t = target(u);
  if (!t) return false;
  const sameImage = p.image === t.image;
  const sameGallery =
    JSON.stringify(p.images ?? []) === JSON.stringify(t.gallery);
  return !sameImage || !sameGallery;
}

/** Проставляет обложку и галерею товарам из photo-updates.json. */
export function applyPhotoUpdates(): { changed: number } {
  const products = readJson<Product[]>("products.json");
  if (!products.some(needsChange)) return { changed: 0 };

  let changed = 0;
  updateJson<Product[]>("products.json", (all) =>
    all.map((p) => {
      if (!needsChange(p)) return p;
      const t = target(MAP[p.slug])!;
      changed++;
      const next: Product = { ...p, image: t.image };
      if (t.gallery.length) next.images = t.gallery;
      else delete next.images;
      return next;
    }),
  );
  return { changed };
}

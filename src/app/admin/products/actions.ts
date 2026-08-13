"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import { saveProductImage, deleteProductImage } from "@/lib/image-pipeline";
import { messageFor, isRedirect } from "@/lib/errors";
import { audit } from "@/lib/audit-log";
import {
  findDeletedProduct,
  moveProductToTrash,
  purgeExpiredDeletedProducts,
  removeFromTrash,
} from "@/lib/product-trash";
import type { Product } from "@/lib/types";
import profileSpecs from "./profile-specs.json";
import { parseCsv } from "@/lib/csv";

/*
  Действия панели над каталогом.

  Каждое действие само проверяет сессию: middleware отсекает только запросы
  без куки и на серверные действия не распространяется. После записи
  сбрасываем кэш всех страниц — цена мелькает в карточке, каталоге, корзине,
  сборках и sitemap, перечислять адреса поштучно смысла нет.
*/

const FILE = "products.json";

export type ActionState = { error?: string; ok?: string };

function refreshSite(): void {
  revalidatePath("/", "layout");
}

/** Наличие: «есть» / «под заказ» / статус неизвестен. */
function parseStock(value: string): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const brand = String(formData.get("brand") ?? "").trim();
    const priceRaw = String(formData.get("price") ?? "").replace(/\s/g, "");
    const price = Number(priceRaw);

    if (!title) return { error: "Впишите название товара." };
    if (!category) return { error: "Выберите категорию." };
    if (!brand) return { error: "Выберите бренд." };
    if (!Number.isFinite(price) || price <= 0) {
      return { error: "Цена должна быть числом больше нуля." };
    }

    const products = readJson<Product[]>(FILE);
    const editingSlug = String(formData.get("slug") ?? "").trim();
    const existing = editingSlug
      ? products.find((p) => p.slug === editingSlug)
      : undefined;

    if (editingSlug && !existing) {
      return { error: "Товар не найден — возможно, его успели удалить." };
    }

    // Резкое падение цены чаще всего опечатка (18 900 → 1 890). Просим
    // подтвердить галочкой, но не запрещаем: распродажи бывают настоящие.
    if (
      existing &&
      price < existing.price / 2 &&
      formData.get("confirmPriceDrop") !== "on"
    ) {
      return {
        error: `Цена падает больше чем вдвое: было ${existing.price} ₽, стало ${price} ₽. Отметьте «Цена указана верно», если это не опечатка.`,
      };
    }

    const description = String(formData.get("description") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const ozonSkuRaw = String(formData.get("ozonSku") ?? "").trim();
    const ozonOfferId = String(formData.get("ozonOfferId") ?? "").trim().slice(0, 120);
    let ozonSku: number | undefined;
    if (ozonSkuRaw) {
      const value = Number(ozonSkuRaw);
      if (!Number.isSafeInteger(value) || value <= 0) {
        return { error: "SKU Ozon должен быть целым положительным числом." };
      }
      ozonSku = value;
    }

    // Сначала проверяем все обычные поля и только потом сохраняем тяжёлые
    // файлы. Ошибка в SKU/остатке больше не оставляет сиротские изображения.
    const flag = parseStock(String(formData.get("inStock") ?? ""));
    const stockRaw = String(formData.get("stock") ?? "").trim();
    let stock: number | undefined;
    if (stockRaw !== "") {
      const value = Number(stockRaw);
      if (!Number.isInteger(value) || value < 0) {
        return { error: "Остаток — целое число, не меньше нуля." };
      }
      stock = value;
    }
    if (stock === undefined && flag === undefined) {
      return { error: "Укажите наличие: «В наличии» или «Под заказ»." };
    }

    const kept = String(formData.get("photos") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const uploads = formData
      .getAll("newPhotos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (kept.length === 0 && uploads.length === 0) {
      return { error: "Добавьте хотя бы одно фото — карточка без снимка не продаёт." };
    }

    const added: string[] = [];
    for (const file of uploads) added.push(await saveProductImage(file));
    const photos = [...kept, ...added];

    const slug =
      existing?.slug ??
      uniqueSlug(
        title,
        products.map((p) => p.slug),
      );

    const product: Product = {
      slug,
      title,
      brand,
      category,
      price: Math.round(price),
      image: photos[0],
      isClearance: formData.get("isClearance") === "on",
      ...(formData.get("isNew") === "on" ? { isNew: true } : {}),
      ...(photos.length > 1 ? { images: photos.slice(1) } : {}),
      ...(description.length ? { description } : {}),
      ...(formData.get("hidden") === "on" ? { hidden: true } : {}),
      ...(ozonSku ? { ozonSku } : {}),
      ...(ozonOfferId ? { ozonOfferId } : {}),
    };

    if (flag !== undefined) product.inStock = flag;
    if (stock !== undefined) product.stock = stock;

    updateJson<Product[]>(FILE, (all) =>
      existing
        ? all.map((p) => (p.slug === slug ? product : p))
        : [product, ...all],
    );
    audit({
      entity: "product",
      entityId: slug,
      action: existing ? "updated" : "created",
      summary: existing ? `Изменён товар «${title}»` : `Создан товар «${title}»`,
      ...(existing ? { before: existing } : {}),
      after: product,
    });
    refreshSite();
  } catch (e) {
    // redirect() внутри try бросает управляющее исключение — пропускаем дальше
    if (isRedirect(e)) throw e;
    return { error: messageFor(e, "Не удалось сохранить товар.", "saveProduct") };
  }

  redirect("/admin/products?saved=1");
}

/* -------------------------- мгновенные операции с фото -------------------- */

/*
  Добавить/заменить/убрать снимок и сменить обложку — сразу, без сохранения
  всей формы. Каждая операция изолирована в своём try/catch: сбой обработки
  одного файла возвращается понятным сообщением, а не роняет страницу
  «server error». Так же щадится память сервера — за раз обрабатывается один
  файл, а не пачка в одном тяжёлом запросе «Сохранить». Порядок = обложка +
  галерея, первый снимок всегда обложка.
*/

export type PhotoResult = { photos?: string[]; error?: string };

/** Применяет fn к списку [обложка, ...галерея] товара и пишет обратно. */
function withPhotos(
  slug: string,
  fn: (photos: string[]) => string[],
): string[] | undefined {
  let out: string[] | undefined;
  updateJson<Product[]>(FILE, (all) =>
    all.map((p) => {
      if (p.slug !== slug) return p;
      const next = fn([p.image, ...(p.images ?? [])]).filter(Boolean);
      if (!next.length) return p; // без фото не оставляем — вызывающий проверил
      out = next;
      const updated: Product = { ...p, image: next[0] };
      if (next.length > 1) updated.images = next.slice(1);
      else delete updated.images;
      return updated;
    }),
  );
  return out;
}

export async function addPhoto(
  slug: string,
  formData: FormData,
): Promise<PhotoResult> {
  try {
    await requireSession();
    assertWritable();
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0)
      return { error: "Файл не выбран." };
    const name = await saveProductImage(file);
    const photos = withPhotos(slug, (cur) => [...cur, name]);
    if (!photos) {
      void deleteProductImage(name); // товар исчез — не плодим сирот
      return { error: "Товар не найден." };
    }
    audit({ entity: "product", entityId: slug, action: "photo_added", summary: "Добавлено фото товара", after: photos });
    refreshSite();
    return { photos };
  } catch (e) {
    return { error: messageFor(e, "Не удалось добавить фото.", "addPhoto") };
  }
}

export async function replacePhoto(
  slug: string,
  oldName: string,
  formData: FormData,
): Promise<PhotoResult> {
  try {
    await requireSession();
    assertWritable();
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0)
      return { error: "Файл не выбран." };
    const name = await saveProductImage(file);
    // Заменяем на месте (обложка остаётся обложкой); если старого уже нет —
    // просто добавляем в конец.
    const photos = withPhotos(slug, (cur) =>
      cur.includes(oldName)
        ? cur.map((p) => (p === oldName ? name : p))
        : [...cur, name],
    );
    if (!photos) {
      void deleteProductImage(name);
      return { error: "Товар не найден." };
    }
    // Старый файл сохраняем: журнал действий и 30-дневная корзина должны
    // позволять восстановить карточку без потерянной фотографии.
    audit({ entity: "product", entityId: slug, action: "photo_replaced", summary: "Заменено фото товара", before: oldName, after: name });
    refreshSite();
    return { photos };
  } catch (e) {
    return { error: messageFor(e, "Не удалось сохранить фото.", "replacePhoto") };
  }
}

export async function removePhoto(
  slug: string,
  name: string,
): Promise<PhotoResult> {
  try {
    await requireSession();
    assertWritable();
    const current = readJson<Product[]>(FILE).find((p) => p.slug === slug);
    if (!current) return { error: "Товар не найден." };
    if (1 + (current.images?.length ?? 0) <= 1)
      return { error: "Нельзя убрать единственное фото — карточке нужен снимок." };
    const photos = withPhotos(slug, (cur) => cur.filter((p) => p !== name));
    audit({ entity: "product", entityId: slug, action: "photo_removed", summary: "Фото убрано из карточки (файл сохранён для восстановления)", before: name, after: photos });
    refreshSite();
    return { photos };
  } catch (e) {
    return { error: messageFor(e, "Не удалось убрать фото.", "removePhoto") };
  }
}

export async function setCover(slug: string, name: string): Promise<PhotoResult> {
  try {
    await requireSession();
    assertWritable();
    const photos = withPhotos(slug, (cur) => [
      name,
      ...cur.filter((p) => p !== name),
    ]);
    if (!photos) return { error: "Товар не найден." };
    audit({ entity: "product", entityId: slug, action: "cover_changed", summary: "Изменена обложка товара", after: name });
    refreshSite();
    return { photos };
  } catch (e) {
    return { error: messageFor(e, "Не удалось сменить обложку.", "setCover") };
  }
}

/**
 * Создать уценённую копию товара.
 *
 * Галочка «Уценённый» помечает всю карточку, а не отдельные единицы: чтобы
 * продавать часть по полной цене, а один экземпляр — со скидкой, нужна вторая
 * карточка. Это действие её и делает: копия помечена уценкой, скрыта (пока
 * владелец не поставит цену уценки, иначе попала бы на распродажу по обычной),
 * остаток 1. Фото копия делит с оригиналом — удаление чистит только файлы, не
 * используемые другими карточками (см. deleteProduct). Сразу открываем копию
 * на редактирование.
 */
export async function createAsClearance(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const products = readJson<Product[]>(FILE);
  const source = products.find((p) => p.slug === slug);
  if (!source) redirect("/admin/products");

  const newSlug = uniqueSlug(
    `${source.title} уценка`,
    products.map((p) => p.slug),
  );

  const copy: Product = {
    ...source,
    slug: newSlug,
    title: `${source.title} (уценка)`,
    isClearance: true,
    hidden: true,
    stock: 1,
  };

  updateJson<Product[]>(FILE, (all) => [copy, ...all]);
  refreshSite();
  redirect(`/admin/products/${newSlug}?copied=1`);
}

/**
 * Массовый импорт характеристик из файла JSON вида
 * `{ "слаг-товара": ["Ключ - значение", …] }`. Для каждого совпавшего товара
 * переписывает поле `description`. Всё через updateJson — читает с диска, так
 * что параллельная правка не теряется; writeJson делает копию в backups/,
 * поэтому импорт откатывается копированием файла обратно.
 */
/*
  Применение характеристик к каталогу — общий код для загрузки файлом и для
  готового набора. Всё через updateJson: читает с диска (параллельная правка не
  теряется), writeJson кладёт копию в backups/, поэтому импорт откатывается.
*/
function applySpecs(data: Record<string, unknown>): {
  updated: number;
  notFound: string[];
} {
  const entries = Object.entries(data);
  let updated = 0;
  const notFound: string[] = [];

  updateJson<Product[]>(FILE, (all) => {
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    for (const [slug, value] of entries) {
      const p = bySlug.get(slug);
      if (!p) {
        notFound.push(slug);
        continue;
      }
      if (!Array.isArray(value)) continue;
      const lines = value.map((v) => String(v).trim()).filter(Boolean);
      if (lines.length) {
        p.description = lines;
        updated++;
      }
    }
    return all;
  });

  refreshSite();
  revalidatePath("/admin/products");
  return { updated, notFound };
}

function specsResult(updated: number, notFound: string[]): ActionState {
  const tail = notFound.length
    ? ` Не найдено на сайте: ${notFound.length} (${notFound.join(", ")}).`
    : "";
  return {
    ok: `Готово. Обновлено характеристик у ${updated} ${updated === 1 ? "товара" : "товаров"}.${tail} Изменения уже на сайте.`,
  };
}

/**
 * Импорт характеристик из загруженного файла JSON вида
 * `{ "слаг-товара": ["Ключ - значение", …] }`.
 */
export async function importSpecs(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Выберите файл JSON с характеристиками." };
    }

    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return { error: "Файл не читается как JSON — проверьте, что это тот самый файл." };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "Ожидается объект вида { \"слаг\": [строки] }." };
    }

    const { updated, notFound } = applySpecs(data as Record<string, unknown>);
    return specsResult(updated, notFound);
  } catch (e) {
    return { error: messageFor(e, "Не удалось импортировать.", "importSpecs") };
  }
}

/**
 * Применить готовый набор характеристик, зашитый в код (profile-specs.json,
 * 59 профильных товаров). Нужен, когда скачать и загрузить файл вручную
 * неудобно: нажал кнопку — характеристики появились.
 */
export async function applyBundledSpecs(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();
    const { updated, notFound } = applySpecs(
      profileSpecs as Record<string, unknown>,
    );
    return specsResult(updated, notFound);
  } catch (e) {
    return {
      error: messageFor(e, "Не удалось применить характеристики.", "applyBundledSpecs"),
    };
  }
}

/**
 * Правка цены и остатка прямо в списке — без захода в карточку.
 * Ради этого сценария всё и затевалось: цены и остатки меняются каждый день,
 * а открывать ради одной цифры полную форму долго.
 */
export async function quickUpdate(
  slug: string,
  price: number,
  stock: number | null,
  confirmPriceDrop = false,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    if (!Number.isFinite(price) || price <= 0) {
      return { error: "Цена должна быть больше нуля." };
    }
    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
      return { error: "Остаток не может быть отрицательным." };
    }

    const products = readJson<Product[]>(FILE);
    const existing = products.find((p) => p.slug === slug);
    if (!existing) return { error: "Товар не найден." };
    if (price < existing.price / 2 && !confirmPriceDrop) {
      return {
        error: `Цена падает больше чем вдвое: было ${existing.price} ₽, стало ${price} ₽. Подтвердите изменение.`,
      };
    }

    updateJson<Product[]>(FILE, (all) =>
      all.map((p) => {
        if (p.slug !== slug) return p;
        const updated: Product = { ...p, price: Math.round(price) };
        if (stock === null) delete updated.stock;
        else updated.stock = Math.round(stock);
        return updated;
      }),
    );
    audit({
      entity: "product",
      entityId: slug,
      action: "quick_updated",
      summary: `Быстро изменены цена/остаток товара «${existing.title}»`,
      before: { price: existing.price, stock: existing.stock },
      after: { price: Math.round(price), stock },
    });
    refreshSite();
    revalidatePath("/admin/products");
    return { ok: "Сохранено" };
  } catch (e) {
    return { error: messageFor(e, "Не удалось сохранить.", "quickUpdate") };
  }
}

export async function toggleHidden(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const existing = readJson<Product[]>(FILE).find((p) => p.slug === slug);
  updateJson<Product[]>(FILE, (all) =>
    all.map((p) => (p.slug === slug ? { ...p, hidden: !p.hidden } : p)),
  );
  if (existing) {
    audit({
      entity: "product",
      entityId: slug,
      action: existing.hidden ? "shown" : "hidden",
      summary: `${existing.hidden ? "Возвращён на витрину" : "Скрыт с витрины"} товар «${existing.title}»`,
      before: { hidden: existing.hidden ?? false },
      after: { hidden: !existing.hidden },
    });
  }
  refreshSite();
  revalidatePath("/admin/products");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const products = readJson<Product[]>(FILE);
  const victim = products.find((p) => p.slug === slug);

  if (!victim) return;
  moveProductToTrash(victim);
  updateJson<Product[]>(FILE, (all) => all.filter((p) => p.slug !== slug));
  audit({ entity: "product", entityId: slug, action: "trashed", summary: `Товар «${victim.title}» перемещён в корзину на 30 дней`, before: victim });

  refreshSite();
  revalidatePath("/admin/products");
}

export async function importCatalogData(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Выберите CSV-файл." };
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return { error: "В файле нет строк с товарами." };
    const headers = rows[0].map((value) => value.trim().toLowerCase());
    const at = (row: string[], name: string) => row[headers.indexOf(name)]?.trim() ?? "";
    if (!headers.includes("slug") && !headers.includes("ozonsku") && !headers.includes("ozonofferid")) return { error: "Нужен столбец slug, ozonSku или ozonOfferId." };
    const source = readJson<Product[]>(FILE);
    let updated = 0;
    const errors: string[] = [];
    const changes = new Map<string, Partial<Product>>();
    for (const [index, row] of rows.slice(1).entries()) {
      const slug = at(row, "slug");
      const sku = at(row, "ozonsku");
      const offer = at(row, "ozonofferid");
      const product = source.find((item) => slug ? item.slug === slug : sku ? String(item.ozonSku ?? "") === sku : item.ozonOfferId === offer);
      if (!product) { errors.push(`строка ${index + 2}: товар не найден`); continue; }
      const patch: Partial<Product> = {};
      const price = at(row, "price");
      const stock = at(row, "stock");
      const inStock = at(row, "instock").toLowerCase();
      if (price) {
        const value = Number(price.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) { errors.push(`строка ${index + 2}: неверная цена`); continue; }
        patch.price = Math.round(value);
      }
      if (stock) {
        const value = Number(stock);
        if (!Number.isInteger(value) || value < 0) { errors.push(`строка ${index + 2}: неверный остаток`); continue; }
        patch.stock = value;
      }
      if (["yes", "да", "true", "1"].includes(inStock)) patch.inStock = true;
      if (["no", "нет", "false", "0"].includes(inStock)) patch.inStock = false;
      if (!Object.keys(patch).length) continue;
      changes.set(product.slug, patch);
      updated++;
    }
    updateJson<Product[]>(FILE, (all) => all.map((product) => changes.has(product.slug) ? { ...product, ...changes.get(product.slug) } : product));
    audit({ entity: "product", entityId: "catalog-import", action: "catalog_import", summary: `Импортированы цены/остатки: ${updated} товаров`, after: { updated, errors: errors.length } });
    refreshSite();
    revalidatePath("/admin/products");
    return { ok: `Обновлено: ${updated}. Пропущено с ошибками: ${errors.length}.${errors.length ? ` Первые ошибки: ${errors.slice(0, 5).join("; ")}` : ""}` };
  } catch (error) {
    return { error: messageFor(error, "Не удалось импортировать каталог.", "importCatalogData") };
  }
}

export async function restoreProductPhotos(slug: string, previous: string[]): Promise<PhotoResult> {
  try {
    await requireSession();
    assertWritable();
    const safe = previous.map(String).filter((name) => name.length > 0 && name.length <= 240 && !name.includes(".."));
    if (!safe.length) return { error: "Нет фотографий для восстановления." };
    const current = readJson<Product[]>(FILE).find((product) => product.slug === slug);
    if (!current) return { error: "Товар не найден." };
    const photos = withPhotos(slug, () => safe);
    audit({ entity: "product", entityId: slug, action: "photos_undo", summary: "Отменено последнее изменение фотографий", before: [current.image, ...(current.images ?? [])], after: safe });
    refreshSite();
    return { photos: photos ?? safe };
  } catch (error) {
    return { error: messageFor(error, "Не удалось вернуть фотографии.", "restoreProductPhotos") };
  }
}

export async function restoreProduct(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();
  const slug = String(formData.get("slug") ?? "");
  const record = findDeletedProduct(slug);
  if (!record) return;
  if (readJson<Product[]>(FILE).some((product) => product.slug === slug)) return;
  updateJson<Product[]>(FILE, (all) => {
    return [record.product, ...all];
  });
  removeFromTrash(slug);
  audit({ entity: "product", entityId: slug, action: "restored", summary: `Восстановлен товар «${record.product.title}»`, after: record.product });
  refreshSite();
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/trash");
}

export async function purgeExpiredTrash(): Promise<void> {
  await requireSession();
  assertWritable();
  const purged = await purgeExpiredDeletedProducts();
  if (purged) audit({ entity: "product", entityId: "trash", action: "purged", summary: `Окончательно удалено просроченных товаров: ${purged}` });
  revalidatePath("/admin/products/trash");
}

const BULK_ACTIONS = new Set([
  "in_stock",
  "preorder",
  "hide",
  "show",
  "new_on",
  "new_off",
  "clearance_on",
  "clearance_off",
]);

export async function bulkUpdateProducts(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();
  const slugs = [...new Set(formData.getAll("slugs").map(String).filter(Boolean))];
  const action = String(formData.get("bulkAction") ?? "");
  if (!slugs.length || !BULK_ACTIONS.has(action)) return;
  const selected = new Set(slugs);
  updateJson<Product[]>(FILE, (all) =>
    all.map((product) => {
      if (!selected.has(product.slug)) return product;
      const next = { ...product };
      if (action === "in_stock" || action === "preorder") {
        delete next.stock;
        next.inStock = action === "in_stock";
      }
      if (action === "hide" || action === "show") next.hidden = action === "hide";
      if (action === "new_on" || action === "new_off") next.isNew = action === "new_on";
      if (action === "clearance_on" || action === "clearance_off") next.isClearance = action === "clearance_on";
      return next;
    }),
  );
  audit({ entity: "product", entityId: slugs.join(","), action: `bulk_${action}`, summary: `Массово изменено товаров: ${slugs.length}` });
  refreshSite();
  revalidatePath("/admin/products");
}

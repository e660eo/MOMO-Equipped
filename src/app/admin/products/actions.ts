"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import { saveProductImage, deleteProductImage } from "@/lib/image-pipeline";
import { messageFor, isRedirect } from "@/lib/errors";
import type { Product } from "@/lib/types";
import profileSpecs from "./profile-specs.json";

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

    // Фото: оставленные в форме (порядок задаёт админ) плюс только что
    // загруженные файлы.
    const kept = String(formData.get("photos") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uploads = formData
      .getAll("newPhotos")
      .filter((f): f is File => f instanceof File && f.size > 0);

    const added: string[] = [];
    for (const file of uploads) {
      added.push(await saveProductImage(file));
    }

    const photos = [...kept, ...added];
    if (photos.length === 0) {
      return { error: "Добавьте хотя бы одно фото — карточка без снимка не продаёт." };
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

    const flag = parseStock(String(formData.get("inStock") ?? ""));
    if (flag !== undefined) product.inStock = flag;

    // Остаток: пустое поле — учёта по товару нет, наличие берётся из флага.
    const stockRaw = String(formData.get("stock") ?? "").trim();
    if (stockRaw !== "") {
      const stock = Number(stockRaw);
      if (!Number.isFinite(stock) || stock < 0) {
        return { error: "Остаток — целое число, не меньше нуля." };
      }
      product.stock = Math.round(stock);
    }

    updateJson<Product[]>(FILE, (all) =>
      existing
        ? all.map((p) => (p.slug === slug ? product : p))
        : [product, ...all],
    );
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

/** Удаляет файл снимка, если он больше не используется ни одним товаром. */
function cleanupPhotoFile(name: string): void {
  const used = readJson<Product[]>(FILE).some(
    (p) => p.image === name || (p.images ?? []).includes(name),
  );
  if (!used) void deleteProductImage(name);
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
    cleanupPhotoFile(oldName);
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
    cleanupPhotoFile(name);
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

    updateJson<Product[]>(FILE, (all) =>
      all.map((p) => {
        if (p.slug !== slug) return p;
        const updated: Product = { ...p, price: Math.round(price) };
        if (stock === null) delete updated.stock;
        else updated.stock = Math.round(stock);
        return updated;
      }),
    );
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
  updateJson<Product[]>(FILE, (all) =>
    all.map((p) => (p.slug === slug ? { ...p, hidden: !p.hidden } : p)),
  );
  refreshSite();
  revalidatePath("/admin/products");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const products = readJson<Product[]>(FILE);
  const victim = products.find((p) => p.slug === slug);

  updateJson<Product[]>(FILE, (all) => all.filter((p) => p.slug !== slug));

  // Файлы фото подчищаем, но только те, что не используются другими
  // карточками: часть снимков досталась каталогу общими.
  if (victim) {
    const stillUsed = new Set(
      products
        .filter((p) => p.slug !== slug)
        .flatMap((p) => [p.image, ...(p.images ?? [])]),
    );
    for (const photo of [victim.image, ...(victim.images ?? [])]) {
      if (!stillUsed.has(photo)) await deleteProductImage(photo);
    }
  }

  refreshSite();
  revalidatePath("/admin/products");
}

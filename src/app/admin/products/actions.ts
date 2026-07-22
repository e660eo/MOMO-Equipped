"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, writeJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import { saveProductImage, deleteProductImage, ImageError } from "@/lib/image-pipeline";
import type { Product } from "@/lib/types";

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
      ...(photos.length > 1 ? { images: photos.slice(1) } : {}),
      ...(description.length ? { description } : {}),
      ...(formData.get("hidden") === "on" ? { hidden: true } : {}),
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

    const next = existing
      ? products.map((p) => (p.slug === slug ? product : p))
      : [product, ...products];

    writeJson(FILE, next);
    refreshSite();
  } catch (e) {
    if (e instanceof ImageError) return { error: e.message };
    // redirect() внутри try бросает управляющее исключение — пропускаем дальше
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      error: e instanceof Error ? e.message : "Не удалось сохранить товар.",
    };
  }

  redirect("/admin/products?saved=1");
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

    const next = products.map((p) => {
      if (p.slug !== slug) return p;
      const updated: Product = { ...p, price: Math.round(price) };
      if (stock === null) delete updated.stock;
      else updated.stock = Math.round(stock);
      return updated;
    });

    writeJson(FILE, next);
    refreshSite();
    revalidatePath("/admin/products");
    return { ok: "Сохранено" };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Не удалось сохранить.",
    };
  }
}

export async function toggleHidden(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  const products = readJson<Product[]>(FILE);
  writeJson(
    FILE,
    products.map((p) =>
      p.slug === slug ? { ...p, hidden: !p.hidden } : p,
    ),
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

  writeJson(
    FILE,
    products.filter((p) => p.slug !== slug),
  );

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

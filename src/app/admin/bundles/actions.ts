"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import { uniqueSlug } from "@/lib/slug";
import type { Bundle, Product } from "@/lib/types";

/*
  Готовые сборки — комплекты с общей скидкой. Цена не хранится: она
  считается из состава в getBundles(), поэтому здесь только список товаров
  и процент скидки.
*/

const FILE = "bundles.json";

export type ActionState = { error?: string };

export async function saveBundle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    const title = String(formData.get("title") ?? "").trim();
    const tagline = String(formData.get("tagline") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const discount = Number(String(formData.get("discountPercent") ?? "").trim());
    const items = formData.getAll("items").map(String).filter(Boolean);

    if (!title) return { error: "Впишите название сборки." };
    if (!Number.isFinite(discount) || discount < 0 || discount > 60) {
      return { error: "Скидка — число от 0 до 60 процентов." };
    }
    if (items.length < 2) {
      return { error: "В сборке должно быть хотя бы два товара." };
    }

    // Товар мог быть удалён из каталога, пока форма была открыта.
    const known = new Set(readJson<Product[]>("products.json").map((p) => p.slug));
    const missing = items.filter((slug) => !known.has(slug));
    if (missing.length) {
      return { error: "Часть товаров уже удалена из каталога — обновите страницу." };
    }

    const bundles = readJson<Bundle[]>(FILE);
    const editing = String(formData.get("slug") ?? "").trim();
    const existing = editing ? bundles.find((b) => b.slug === editing) : undefined;
    if (editing && !existing) return { error: "Сборка не найдена." };

    const bundle: Bundle = {
      slug:
        existing?.slug ??
        uniqueSlug(
          title,
          bundles.map((b) => b.slug),
        ),
      title,
      tagline,
      description,
      discountPercent: Math.round(discount),
      items,
    };

    updateJson<Bundle[]>(FILE, (all) =>
      existing
        ? all.map((b) => (b.slug === bundle.slug ? bundle : b))
        : [...all, bundle],
    );
    revalidatePath("/", "layout");
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Не удалось сохранить." };
  }

  redirect("/admin/bundles?saved=1");
}

export async function deleteBundle(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();

  const slug = String(formData.get("slug") ?? "");
  updateJson<Bundle[]>(FILE, (all) => all.filter((b) => b.slug !== slug));
  revalidatePath("/", "layout");
  revalidatePath("/admin/bundles");
}

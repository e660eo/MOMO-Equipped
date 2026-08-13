"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { savePromo, deletePromo } from "@/lib/promos";

/*
  Промокоды в панели. Создание и правка — одно действие (upsert по коду):
  форма создания и строка правки шлют сюда же. Ошибку и успех показываем через
  адрес (?error / ?saved), как на странице товаров, — без клиентских форм.
*/

export async function savePromoAction(formData: FormData): Promise<void> {
  await requireSession();

  const res = savePromo({
    code: String(formData.get("code") ?? ""),
    percent: Number(String(formData.get("percent") ?? "").replace(",", ".")),
    limit: Number(String(formData.get("limit") ?? "").trim() || "0"),
    active: formData.get("active") === "on",
    startsAt: String(formData.get("startsAt") ?? "").trim(),
    endsAt: String(formData.get("endsAt") ?? "").trim(),
    minSubtotal: Number(String(formData.get("minSubtotal") ?? "").trim() || "0"),
    maxDiscount: Number(String(formData.get("maxDiscount") ?? "").trim() || "0"),
    perCustomerLimit: Number(String(formData.get("perCustomerLimit") ?? "").trim() || "0"),
    productSlugs: String(formData.get("productSlugs") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    categories: formData.getAll("categories").map(String).filter(Boolean),
  });

  revalidatePath("/admin/promos");
  redirect(
    res.ok
      ? "/admin/promos?saved=1"
      : `/admin/promos?error=${encodeURIComponent(res.error)}`,
  );
}

export async function deletePromoAction(formData: FormData): Promise<void> {
  await requireSession();
  deletePromo(String(formData.get("code") ?? ""));
  revalidatePath("/admin/promos");
}

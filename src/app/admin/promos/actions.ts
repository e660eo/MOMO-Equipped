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

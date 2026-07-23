"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { resetPassword } from "@/lib/customers";
import { messageFor } from "@/lib/errors";

/*
  Сброс пароля покупателя.

  Писем сайт не отправляет, поэтому «забыл пароль» решается по-человечески:
  владелец выдаёт временный пароль и диктует его в переписке или по телефону.
  Пароль показывается один раз — на сервере остаётся только хеш.
*/
export async function issueTempPassword(
  customerId: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  try {
    await requireSession();
    const password = resetPassword(customerId);
    if (!password) return { ok: false, error: "Покупатель не найден." };

    revalidatePath("/admin/customers");
    return { ok: true, password };
  } catch (e) {
    return {
      ok: false,
      error: messageFor(e, "Не получилось сбросить пароль.", "issueTempPassword"),
    };
  }
}

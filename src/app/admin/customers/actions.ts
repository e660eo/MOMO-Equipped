"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { findCustomer, resetPassword, updateCustomerAdmin } from "@/lib/customers";
import { messageFor } from "@/lib/errors";
import { adjustCustomerBonus, getBonusSummary } from "@/lib/bonus-ledger";

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

export async function saveCustomerAdmin(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  updateCustomerAdmin(id, {
    note: String(formData.get("note") ?? ""),
    tags: String(formData.get("tags") ?? "").split(","),
    event: String(formData.get("event") ?? ""),
  });
  revalidatePath("/admin/customers");
}

export type BonusActionState = { ok?: string; error?: string };

export async function adjustCustomerBonusAction(
  _previous: BonusActionState,
  formData: FormData,
): Promise<BonusActionState> {
  try {
    await requireSession();
    const customerId = String(formData.get("customerId") ?? "");
    const customer = findCustomer(customerId);
    if (!customer) return { error: "Покупатель не найден." };
    const raw = Number(String(formData.get("amount") ?? "").trim());
    const operation = String(formData.get("operation") ?? "credit");
    const amount = operation === "debit" ? -Math.abs(raw) : Math.abs(raw);
    const entry = adjustCustomerBonus({
      customerId,
      amount,
      reason: String(formData.get("reason") ?? ""),
    });
    const balance = getBonusSummary(customerId).balance;
    revalidatePath("/admin/customers");
    revalidatePath("/profile");
    return {
      ok: `${entry.amount > 0 ? "Начислено" : "Списано"} ${Math.abs(entry.amount)}. Баланс: ${balance}.`,
    };
  } catch (error) {
    return { error: messageFor(error, "Не удалось изменить бонусы.", "adjustCustomerBonus") };
  }
}

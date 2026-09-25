"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { startDealerSession } from "@/lib/dealer-auth";
import { findDealerAccount, getDealerLocation } from "@/lib/dealers";
import { audit } from "@/lib/audit-log";
import { messageFor } from "@/lib/errors";

export async function openDemoDealerCabinet(_previous: { error?: string }): Promise<{ error?: string }> {
  try {
    await requireSession();
    // Fixed existing demo account: never accept a target account from the browser.
    const account = findDealerAccount("trial-dealer-account");
    if (!account || account.dealerId !== "trial-dealer-momo" || !getDealerLocation(account.dealerId)) {
      return { error: "Демо-аккаунт MOMO не найден. Проверьте список дилеров." };
    }
    if (account.disabled || !account.activatedAt) {
      return { error: "Демо-аккаунт отключён или ещё не активирован." };
    }
    audit({ entity: "dealer", entityId: account.id, action: "demo_opened", summary: "Администратор открыл демо-кабинет MOMO" });
    await startDealerSession(account.id);
  } catch (error) {
    return { error: messageFor(error, "Не удалось открыть демо-кабинет. Повторите попытку.", "openDemoDealerCabinet") };
  }
  redirect("/dealer");
}

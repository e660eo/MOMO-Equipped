"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import type { SiteConfig } from "@/lib/types";

/*
  Контакты и цифры доверия.

  Реквизиты ИП тут намеренно не правятся: они меняются раз в годы, зато любой
  промах в счёте или ИНН сразу уходит в договоры и счета. Понадобится
  поменять — сделаем отдельно и с проверкой.
*/

const FILE = "site.json";

export type ActionState = { error?: string };

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function saveSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSession();
    assertWritable();

    const get = (name: string) => String(formData.get(name) ?? "").trim();

    const phone = get("phone");
    const email = get("email");
    const whatsapp = get("whatsapp");
    const telegram = get("telegram");

    if (digitsOnly(phone).length < 11) {
      return { error: "Телефон должен содержать 11 цифр: +7 XXX XXX XXXX." };
    }
    if (!email.includes("@")) return { error: "Проверьте адрес почты." };
    for (const [name, url] of [
      ["WhatsApp", whatsapp],
      ["Telegram", telegram],
    ] as const) {
      if (url && !url.startsWith("https://")) {
        return { error: `Ссылка ${name} должна начинаться с https://` };
      }
    }

    const warranty = Number(get("warrantyMonths"));
    const returnDays = Number(get("returnDays"));
    const processing = Number(get("processingDays"));
    const freeFrom = Number(get("freeShippingFrom"));
    if ([warranty, returnDays, processing, freeFrom].some((n) => !Number.isFinite(n) || n < 0)) {
      return { error: "Гарантия, возврат, обработка и порог доставки — числа." };
    }

    const site = readJson<SiteConfig>(FILE);
    const next: SiteConfig = {
      ...site,
      contacts: {
        ...site.contacts,
        phone,
        phoneSecondary: get("phoneSecondary"),
        email,
        address: get("address"),
        hours: get("hours"),
        whatsapp,
        telegram,
      },
      trust: {
        warrantyMonths: Math.round(warranty),
        returnDays: Math.round(returnDays),
        processingDays: Math.round(processing),
        freeShippingFrom: Math.round(freeFrom),
      },
    };

    updateJson<SiteConfig>(FILE, () => next);
    revalidatePath("/", "layout");
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Не удалось сохранить." };
  }

  redirect("/admin/settings?saved=1");
}

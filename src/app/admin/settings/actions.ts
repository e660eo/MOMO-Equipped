"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { readJson, updateJson, assertWritable } from "@/lib/store";
import { sendMail, mailerConfig } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site-url";
import { messageFor, isRedirect } from "@/lib/errors";
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
    if (isRedirect(e)) throw e;
    return { error: messageFor(e, "Не удалось сохранить.", "saveSettings") };
  }

  redirect("/admin/settings?saved=1");
}

/* --------------------------- проверка почты ------------------------------ */

export type MailTestState = { ok?: string; error?: string };

/**
 * Пробное письмо на тот же адрес, куда уходят заказы.
 *
 * Настройки почты живут в окружении сервера — из панели их не поменять, но
 * увидеть, работают ли они, можно и нужно: неверный пароль ящика иначе
 * обнаружится только на потерянном заказе.
 */
export async function sendTestMail(
  _prev: MailTestState,
  _formData: FormData,
): Promise<MailTestState> {
  try {
    await requireSession();
  } catch (e) {
    return { error: messageFor(e, "Нужно войти заново.", "sendTestMail") };
  }

  const config = mailerConfig();
  if (!config) {
    return {
      error:
        "Почтовый ящик не подключён. Нужны переменные SMTP_USER и SMTP_PASS " +
        "в файле .env.local на сервере — раздел «Письма о заказах» в DEPLOY.md.",
    };
  }

  const when = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const result = await sendMail({
    subject: "MOMO — проверка почты",
    text: `Почта подключена. Уведомления о новых заказах будут приходить на этот адрес.\n\n${when}\n${SITE_URL}/admin/orders`,
    html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
  <p><b>Почта подключена.</b> Уведомления о новых заказах будут приходить на этот адрес.</p>
  <p style="color:#767676;font-size:13px;">Проверка отправлена ${when} из панели управления сайтом.</p>
</div>`,
  });

  if (!result.ok) return { error: result.error };
  return { ok: `Письмо отправлено на ${result.to.join(", ")}. Проверьте ящик.` };
}

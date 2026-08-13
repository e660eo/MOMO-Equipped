"use server";

import { revalidatePath } from "next/cache";
import { addDealerApplication } from "@/lib/dealers";
import { notifyDealerApplication } from "@/lib/dealer-mail";
import { clientIp } from "@/lib/client-ip";
import { isPhoneComplete } from "@/lib/phone";
import { audit } from "@/lib/audit-log";
import type { DealerApplication } from "@/lib/types";

export type DealerApplicationState = { error?: string; ok?: string };

const recent = new Map<string, number[]>();
const WINDOW = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const active = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW);
  recent.set(ip, [...active, now]);
  return active.length >= 5;
}
const clean = (value: FormDataEntryValue | null, limit: number) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

export async function submitDealerApplication(
  _previous: DealerApplicationState,
  formData: FormData,
): Promise<DealerApplicationState> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { error: "Слишком много заявок подряд. Позвоните нам — ответим сразу." };

  const company = clean(formData.get("company"), 160);
  const city = clean(formData.get("city"), 100);
  const contactName = clean(formData.get("contactName"), 120);
  const phone = clean(formData.get("phone"), 30);
  const email = clean(formData.get("email"), 160).toLowerCase();
  const website = clean(formData.get("website"), 240);
  const comment = clean(formData.get("comment"), 1500);
  const businessType = clean(formData.get("businessType"), 20) as DealerApplication["businessType"];

  if (!company || !city || !contactName || !phone || !email || !businessType) {
    return { error: "Заполните компанию, город, контактное лицо, телефон, email и формат работы." };
  }
  if (!isPhoneComplete(phone)) return { error: "Проверьте номер телефона." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Проверьте email." };
  if (!(["store", "install", "online", "mixed"] as string[]).includes(businessType)) {
    return { error: "Выберите формат работы." };
  }
  if (formData.get("consent") !== "on") return { error: "Нужно согласие на обработку данных." };

  try {
    const application = addDealerApplication({
      company,
      city,
      contactName,
      phone,
      email,
      businessType,
      ...(website ? { website } : {}),
      ...(comment ? { comment } : {}),
    });
    audit({ entity: "dealer", entityId: application.id, action: "application_created", summary: `Новая дилерская заявка: ${company}, ${city}`, actor: "Посетитель сайта" });
    // Заявка уже сохранена: сбой SMTP не должен просить человека отправлять её повторно.
    try { await notifyDealerApplication(application); } catch (error) { console.error("dealer application mail:", error); }
    revalidatePath("/admin/dealers");
    return { ok: "Заявка принята. Менеджер свяжется с вами и уточнит формат сотрудничества." };
  } catch (error) {
    console.error("dealer application:", error);
    return { error: "Не удалось сохранить заявку. Позвоните нам или напишите в WhatsApp." };
  }
}

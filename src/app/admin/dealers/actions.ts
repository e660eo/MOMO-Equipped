"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit-log";
import {
  DEALER_LOCATION_KINDS,
  DEALER_LOCATION_KIND_LABELS,
  DEALER_OFFICIAL_STATUSES,
} from "@/lib/dealer-location";
import { sendDealerInvite, sendDealerPasswordReset } from "@/lib/dealer-mail";
import {
  createDealer,
  deleteDealerApplication,
  deleteDealer,
  findDealerAccount,
  getDealerAccounts,
  getDealerApplication,
  getDealerLocation,
  issueDealerInvite,
  recordDealerAccessMail,
  setDealerApplicationArchived,
  setDealerLocationActive,
  setDealerLocationProfile,
  updateDealerAccountProfile,
  updateDealerApplication,
  updateDealerLocationDetails,
  updateDealerOrderStatus,
  updateDealerTerms,
} from "@/lib/dealers";
import { ExpectedError, messageFor } from "@/lib/errors";
import { SITE_URL } from "@/lib/site-url";
import { DEALER_PRICE_TIERS, DEALER_PRICE_TIER_LABELS } from "@/lib/b2b-prices";
import type {
  DealerApplicationStatus,
  DealerLocationKind,
  DealerOfficialStatus,
  DealerOrderStatus,
  DealerPriceTier,
} from "@/lib/types";

export type CreateDealerState = { error?: string; ok?: boolean; inviteUrl?: string; mailSent?: boolean };
export type UpdateDealerState = {
  error?: string;
  ok?: boolean;
  officialStatus?: DealerOfficialStatus;
};

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = text(formData, key, 30);
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new ExpectedError(`Проверьте поле «${key}».`);
  return parsed;
}

export async function createDealerAdmin(_state: CreateDealerState, formData: FormData): Promise<CreateDealerState> {
  await requireSession();
  try {
    const name = text(formData, "name");
    const city = text(formData, "city", 120);
    const address = text(formData, "address", 240);
    const phone = text(formData, "phone", 40);
    const contactName = text(formData, "contactName", 120);
    const loginEmail = text(formData, "loginEmail", 160).toLowerCase();
    const priceTier = text(formData, "priceTier", 20) as DealerPriceTier;
    const kind = text(formData, "kind", 30) as DealerLocationKind;
    const officialStatus = text(formData, "officialStatus", 30) as DealerOfficialStatus;
    const discountPercent = Number(text(formData, "discountPercent", 10));
    if (!name || !city || !address || !phone || !contactName || !loginEmail) throw new ExpectedError("Заполните название, город, адрес, телефон, контакт и email входа.");
    if (!/^\S+@\S+\.\S+$/.test(loginEmail)) throw new ExpectedError("Проверьте email для входа.");
    if (!DEALER_PRICE_TIERS.includes(priceTier)) throw new ExpectedError("Выберите ценовой уровень партнёра.");
    if (!DEALER_LOCATION_KINDS.includes(kind)) throw new ExpectedError("Выберите тип дилерской точки.");
    if (!DEALER_OFFICIAL_STATUSES.includes(officialStatus)) throw new ExpectedError("Выберите статус партнёра.");
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 80) throw new ExpectedError("Скидка должна быть от 0 до 80%.");
    const latitude = optionalNumber(formData, "latitude");
    const longitude = optionalNumber(formData, "longitude");
    if ((latitude === undefined) !== (longitude === undefined)) throw new ExpectedError("Укажите и широту, и долготу — либо оставьте оба поля пустыми.");
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) throw new ExpectedError("Широта должна быть от −90 до 90.");
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) throw new ExpectedError("Долгота должна быть от −180 до 180.");
    const result = createDealer({
      name,
      city,
      address,
      phone,
      publicEmail: text(formData, "publicEmail", 160) || undefined,
      website: text(formData, "website", 240) || undefined,
      hours: text(formData, "hours", 160) || undefined,
      latitude,
      longitude,
      kind,
      officialStatus,
      authorizedInstallation: kind !== "store" && formData.get("authorizedInstallation") === "on",
      contactName,
      loginEmail,
      priceTier,
      discountPercent,
      applicationId: text(formData, "applicationId", 80) || undefined,
    });
    const mail = await sendDealerInvite(result.account, result.dealer, result.inviteToken);
    const inviteUrl = `${SITE_URL}/dealer/activate?token=${encodeURIComponent(result.inviteToken)}`;
    audit({ entity: "dealer", entityId: result.account.id, action: "dealer_created", summary: `Создан дилер ${result.dealer.name}; ${DEALER_PRICE_TIER_LABELS[priceTier]}; резервная скидка ${discountPercent}%`, after: { dealer: result.dealer, account: { ...result.account, passwordHash: "[hidden]", inviteHash: "[hidden]" } } });
    revalidatePath("/admin/dealers");
    revalidatePath("/dealers");
    return { ok: true, inviteUrl, mailSent: mail.ok };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") return { error: "Дилер с таким email уже существует." };
    return { error: messageFor(error, "Не удалось создать дилера.", "createDealerAdmin") };
  }
}

export async function updateDealerAdmin(
  _state: UpdateDealerState,
  formData: FormData,
): Promise<UpdateDealerState> {
  await requireSession();
  try {
    const id = text(formData, "id", 80);
    const before = getDealerLocation(id);
    if (!before) throw new ExpectedError("Партнёрская точка не найдена.");

    const name = text(formData, "name");
    const city = text(formData, "city", 120);
    const address = text(formData, "address", 240);
    const phone = text(formData, "phone", 40);
    const publicEmail = text(formData, "publicEmail", 160).toLowerCase();
    const website = text(formData, "website", 240);
    const hours = text(formData, "hours", 160);
    const kind = text(formData, "kind", 30) as DealerLocationKind;
    const officialStatus = text(formData, "officialStatus", 30) as DealerOfficialStatus;
    if (!name || !city || !address || !phone) {
      throw new ExpectedError("Заполните название, город, адрес и телефон.");
    }
    if (publicEmail && !/^\S+@\S+\.\S+$/.test(publicEmail)) {
      throw new ExpectedError("Проверьте публичный email.");
    }
    if (website) {
      try {
        const parsedWebsite = new URL(website);
        if (!['http:', 'https:'].includes(parsedWebsite.protocol)) throw new Error();
      } catch {
        throw new ExpectedError("Адрес сайта должен начинаться с http:// или https://.");
      }
    }
    if (!DEALER_LOCATION_KINDS.includes(kind)) {
      throw new ExpectedError("Выберите тип дилерской точки.");
    }
    if (!DEALER_OFFICIAL_STATUSES.includes(officialStatus)) {
      throw new ExpectedError("Выберите статус партнёра.");
    }

    const latitude = optionalNumber(formData, "latitude");
    const longitude = optionalNumber(formData, "longitude");
    if ((latitude === undefined) !== (longitude === undefined)) {
      throw new ExpectedError("Укажите и широту, и долготу — либо оставьте оба поля пустыми.");
    }
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      throw new ExpectedError("Широта должна быть от −90 до 90.");
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      throw new ExpectedError("Долгота должна быть от −180 до 180.");
    }

    const account = getDealerAccounts().find((item) => item.dealerId === id);
    let updatedAccount = account;
    if (account) {
      const contactName = text(formData, "contactName", 120);
      const loginEmail = text(formData, "loginEmail", 160).toLowerCase();
      const priceTier = text(formData, "priceTier", 20) as DealerPriceTier;
      const discountPercent = Number(text(formData, "discountPercent", 10));
      if (!contactName || !loginEmail) {
        throw new ExpectedError("Заполните контактное лицо и email для входа.");
      }
      if (!/^\S+@\S+\.\S+$/.test(loginEmail)) {
        throw new ExpectedError("Проверьте email для входа.");
      }
      if (!DEALER_PRICE_TIERS.includes(priceTier)) {
        throw new ExpectedError("Выберите ценовой уровень партнёра.");
      }
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 80) {
        throw new ExpectedError("Скидка должна быть от 0 до 80%.");
      }
      updatedAccount = updateDealerAccountProfile(account.id, {
        contactName,
        email: loginEmail,
        priceTier,
        discountPercent,
      });
    }

    const authorizedInstallation = kind !== "store" && formData.get("authorizedInstallation") === "on";
    const after = updateDealerLocationDetails(id, {
      name,
      city,
      address,
      phone,
      email: publicEmail || undefined,
      website: website || undefined,
      hours: hours || undefined,
      latitude,
      longitude,
      kind,
      officialStatus,
      authorizedInstallation,
    });
    if (!after) throw new ExpectedError("Не удалось сохранить партнёрскую точку.");

    audit({
      entity: "dealer",
      entityId: id,
      action: "dealer_updated",
      summary: `Обновлены данные дилера ${after.name}`,
      before: {
        dealer: before,
        account: account ? { contactName: account.contactName, email: account.email, priceTier: account.priceTier, discountPercent: account.discountPercent } : undefined,
      },
      after: {
        dealer: after,
        account: updatedAccount ? { contactName: updatedAccount.contactName, email: updatedAccount.email, priceTier: updatedAccount.priceTier, discountPercent: updatedAccount.discountPercent } : undefined,
      },
    });
    revalidatePath("/admin/dealers");
    revalidatePath(`/admin/dealers/${id}/edit`);
    revalidatePath("/dealers");
    revalidatePath("/dealer");
    return { ok: true, officialStatus };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      return { error: "Дилер с таким email для входа уже существует." };
    }
    return { error: messageFor(error, "Не удалось обновить дилера.", "updateDealerAdmin") };
  }
}

export async function resendDealerInvite(formData: FormData): Promise<void> {
  await enableAndSendDealerAccess(formData);
}

/** Включить доступ и отправить дилеру ссылку установки нового пароля. */
export async function enableAndSendDealerAccess(formData: FormData): Promise<void> {
  await requireSession();
  const accountId = text(formData, "accountId", 80);
  const account = findDealerAccount(accountId);
  const dealer = account ? getDealerLocation(account.dealerId) : undefined;
  if (!account || !dealer) return;

  if (account.disabled) updateDealerTerms(account.id, { disabled: false });
  const enabled = findDealerAccount(account.id);
  const token = issueDealerInvite(account.id);
  if (!enabled || !token) return;
  const result = enabled.activatedAt
    ? await sendDealerPasswordReset(enabled, dealer, token)
    : await sendDealerInvite(enabled, dealer, token);
  recordDealerAccessMail(account.id, result);
  audit({
    entity: "dealer",
    entityId: account.id,
    action: "access_link_sent",
    summary: `${account.disabled ? "Дилер включён; " : ""}отправлена ссылка нового пароля: ${account.email}`,
    after: { mailSent: result.ok },
  });
  revalidatePath("/admin/dealers");
}

export async function setDealerApplicationStatus(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const status = text(formData, "status", 20) as DealerApplicationStatus;
  const allowed: DealerApplicationStatus[] = ["new", "in_work", "approved", "rejected"];
  if (!id || !allowed.includes(status)) return;
  const note = text(formData, "note", 500);
  updateDealerApplication(id, { status, ...(note ? { note } : {}) });
  audit({ entity: "dealer", entityId: id, action: "application_status", summary: `Статус дилерской заявки: ${status}` });
  revalidatePath("/admin/dealers");
}

export async function archiveDealerApplicationAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const before = getDealerApplication(id);
  if (!before || before.archivedAt) return;
  const after = setDealerApplicationArchived(id, true);
  if (!after) return;
  audit({
    entity: "dealer",
    entityId: id,
    action: "application_archived",
    summary: `Заявка ${after.company} перемещена в архив`,
    before: { archivedAt: before.archivedAt },
    after: { archivedAt: after.archivedAt },
  });
  revalidatePath("/admin/dealers");
}

export async function restoreDealerApplicationAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const before = getDealerApplication(id);
  if (!before?.archivedAt) return;
  const after = setDealerApplicationArchived(id, false);
  if (!after) return;
  audit({
    entity: "dealer",
    entityId: id,
    action: "application_restored",
    summary: `Заявка ${after.company} восстановлена из архива`,
    before: { archivedAt: before.archivedAt },
    after: { archivedAt: after.archivedAt },
  });
  revalidatePath("/admin/dealers");
}

export async function deleteDealerApplicationAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const before = getDealerApplication(id);
  // Удалять можно только из архива: это защищает рабочие заявки от случайного удаления.
  if (!before?.archivedAt) return;
  const deleted = deleteDealerApplication(id);
  if (!deleted) return;
  audit({
    entity: "dealer",
    entityId: id,
    action: "application_deleted",
    summary: `Окончательно удалена заявка ${deleted.company}`,
    before: deleted,
  });
  revalidatePath("/admin/dealers");
}

export async function setDealerLocationVisibility(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const before = getDealerLocation(id);
  if (!before) return;
  const active = formData.get("active") === "true";
  const after = setDealerLocationActive(id, active);
  if (!after) return;
  audit({
    entity: "dealer",
    entityId: id,
    action: active ? "location_published" : "location_hidden",
    summary: `${active ? "Опубликована" : "Скрыта"} дилерская точка ${after.name}`,
    before: { active: before.active },
    after: { active: after.active },
  });
  revalidatePath("/admin/dealers");
  revalidatePath("/dealers");
}

export async function deleteDealerAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  if (!id) return;

  const result = deleteDealer(id);
  if (!result) return;

  audit({
    entity: "dealer",
    entityId: id,
    action: "dealer_deleted",
    summary: `Удалён дилер ${result.dealer.name}; удалено кабинетов: ${result.removedAccounts.length}; история заказов сохранена`,
    before: {
      dealer: result.dealer,
      accounts: result.removedAccounts.map((account) => ({
        ...account,
        passwordHash: "[hidden]",
        inviteHash: account.inviteHash ? "[hidden]" : undefined,
      })),
    },
  });
  revalidatePath("/admin/dealers");
  revalidatePath("/dealers");
  revalidatePath("/dealer");
}

export async function setDealerLocationProfileAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const kind = text(formData, "kind", 30) as DealerLocationKind;
  const before = getDealerLocation(id);
  if (!before || !DEALER_LOCATION_KINDS.includes(kind)) return;
  const authorizedInstallation = kind !== "store" && formData.get("authorizedInstallation") === "on";
  const after = setDealerLocationProfile(id, { kind, authorizedInstallation });
  if (!after) return;
  audit({
    entity: "dealer",
    entityId: id,
    action: "location_profile_updated",
    summary: `Тип точки ${after.name}: ${DEALER_LOCATION_KIND_LABELS[kind]}${authorizedInstallation ? "; авторизованная установка" : ""}`,
    before: { kind: before.kind, authorizedInstallation: before.authorizedInstallation },
    after: { kind: after.kind, authorizedInstallation: after.authorizedInstallation },
  });
  revalidatePath("/admin/dealers");
  revalidatePath("/dealers");
}

export async function setDealerTerms(formData: FormData): Promise<void> {
  await requireSession();
  const accountId = text(formData, "accountId", 80);
  const priceTier = text(formData, "priceTier", 20) as DealerPriceTier;
  const discountPercent = Number(text(formData, "discountPercent", 10));
  if (!accountId || !DEALER_PRICE_TIERS.includes(priceTier) || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 80) return;
  updateDealerTerms(accountId, { priceTier, discountPercent, disabled: formData.get("disabled") === "on" });
  audit({ entity: "dealer", entityId: accountId, action: "terms_updated", summary: `Условия дилера обновлены: ${DEALER_PRICE_TIER_LABELS[priceTier]}, резервная скидка ${discountPercent}%` });
  revalidatePath("/admin/dealers");
  revalidatePath("/dealer");
}

export async function setDealerOrderStatus(formData: FormData): Promise<void> {
  await requireSession();
  const id = text(formData, "id", 80);
  const status = text(formData, "status", 20) as DealerOrderStatus;
  const allowed: DealerOrderStatus[] = ["new", "confirmed", "shipped", "done", "canceled"];
  if (!id || !allowed.includes(status)) return;
  updateDealerOrderStatus(id, status);
  audit({ entity: "dealer", entityId: id, action: "order_status", summary: `Статус дилерского заказа: ${status}` });
  revalidatePath("/admin/dealers");
  revalidatePath("/dealer");
}

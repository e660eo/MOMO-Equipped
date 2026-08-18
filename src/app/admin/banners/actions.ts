"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit-log";
import { deleteBannerMedia, saveBannerMedia } from "@/lib/banner-media";
import {
  getBanners,
  normalizeBannerHref,
  removeBanner,
  upsertBanner,
} from "@/lib/banners";
import { ExpectedError, isRedirect, messageFor } from "@/lib/errors";
import { assertWritable } from "@/lib/store";
import type {
  BannerActionKind,
  BannerMediaAlign,
  BannerMediaFit,
  BannerTheme,
  SiteBanner,
} from "@/lib/types";

const THEMES = new Set<BannerTheme>(["dark", "light", "signal"]);
const FITS = new Set<BannerMediaFit>(["cover", "contain"]);
const ALIGNS = new Set<BannerMediaAlign>(["left", "center", "right"]);
const ACTIONS = new Set<BannerActionKind>(["none", "banner", "button"]);

export type BannerActionState = { error?: string };

function field(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").trim().slice(0, max + 1);
}

export async function saveBannerAction(
  _previous: BannerActionState,
  formData: FormData,
): Promise<BannerActionState> {
  let uploaded: Awaited<ReturnType<typeof saveBannerMedia>> | undefined;
  let committed = false;

  try {
    await requireSession();
    assertWritable();

    const id = field(formData, "id", 100);
    const existing = id ? getBanners().find((banner) => banner.id === id) : undefined;
    if (id && !existing) throw new ExpectedError("Баннер не найден — обновите страницу.");

    const name = field(formData, "name", 120);
    const alt = field(formData, "alt", 240);
    const eyebrow = field(formData, "eyebrow", 100);
    const heading = field(formData, "heading", 180);
    const description = field(formData, "description", 600);
    if (!name) throw new ExpectedError("Впишите название баннера для панели.");
    if (name.length > 120) throw new ExpectedError("Название длиннее 120 знаков.");
    if (alt.length > 240) throw new ExpectedError("Описание медиа длиннее 240 знаков.");
    if (eyebrow.length > 100) throw new ExpectedError("Надпись над заголовком длиннее 100 знаков.");
    if (heading.length > 180) throw new ExpectedError("Заголовок длиннее 180 знаков.");
    if (description.length > 600) throw new ExpectedError("Описание длиннее 600 знаков.");

    const theme = field(formData, "theme", 20) as BannerTheme;
    const mediaFit = field(formData, "mediaFit", 20) as BannerMediaFit;
    const mediaAlign = field(formData, "mediaAlign", 20) as BannerMediaAlign;
    const actionKind = field(formData, "actionKind", 20) as BannerActionKind;
    if (!THEMES.has(theme)) throw new ExpectedError("Выберите оформление баннера.");
    if (!FITS.has(mediaFit)) throw new ExpectedError("Выберите заполнение фото или видео.");
    if (!ALIGNS.has(mediaAlign)) throw new ExpectedError("Выберите положение медиа.");
    if (!ACTIONS.has(actionKind)) throw new ExpectedError("Выберите действие при нажатии.");

    const rawOrder = Number(field(formData, "order", 5));
    if (!Number.isInteger(rawOrder) || rawOrder < 0 || rawOrder > 9999) {
      throw new ExpectedError("Порядок должен быть целым числом от 0 до 9999.");
    }

    const href = field(formData, "href", 1000);
    const buttonLabel = field(formData, "buttonLabel", 80);
    if (actionKind === "button" && !buttonLabel) {
      throw new ExpectedError("Впишите текст кнопки.");
    }
    const action: SiteBanner["action"] =
      actionKind === "none"
        ? { kind: "none" }
        : {
            kind: actionKind,
            href: normalizeBannerHref(href),
            ...(actionKind === "button" ? { label: buttonLabel } : {}),
            ...(formData.get("newTab") === "on" ? { newTab: true } : {}),
          };

    const upload = formData.get("media");
    if (upload instanceof File && upload.size > 0) {
      uploaded = await saveBannerMedia(upload);
    }
    if (!existing && !uploaded) throw new ExpectedError("Прикрепите фото или видео.");

    const now = new Date().toISOString();
    const next: SiteBanner = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      media: uploaded?.file ?? existing!.media,
      mediaType: uploaded?.type ?? existing!.mediaType,
      ...(uploaded?.originalName || existing?.originalName
        ? { originalName: uploaded?.originalName ?? existing?.originalName }
        : {}),
      ...(alt ? { alt } : {}),
      ...(eyebrow ? { eyebrow } : {}),
      ...(heading ? { heading } : {}),
      ...(description ? { description } : {}),
      theme,
      mediaFit,
      mediaAlign,
      action,
      active: formData.get("active") === "on",
      order: rawOrder,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    upsertBanner(next);
    committed = true;
    if (uploaded && existing && existing.media !== uploaded.file) {
      await deleteBannerMedia(existing.media);
    }
    audit({
      entity: "banner",
      entityId: next.id,
      action: existing ? "updated" : "created",
      summary: `${existing ? "Изменён" : "Создан"} баннер «${name}»`,
      ...(existing ? { before: existing } : {}),
      after: next,
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/banners");
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (uploaded && !committed) await deleteBannerMedia(uploaded.file);
    return {
      error: messageFor(error, "Не удалось сохранить баннер.", "saveBannerAction"),
    };
  }

  redirect("/admin/banners?saved=1");
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();
  const id = String(formData.get("id") ?? "").trim();
  const removed = removeBanner(id);
  if (removed) {
    await deleteBannerMedia(removed.media);
    audit({
      entity: "banner",
      entityId: removed.id,
      action: "deleted",
      summary: `Удалён баннер «${removed.name}»`,
      before: removed,
    });
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/banners");
  redirect("/admin/banners?deleted=1");
}

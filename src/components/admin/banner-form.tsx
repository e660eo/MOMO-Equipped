"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { saveBannerAction, type BannerActionState } from "@/app/admin/banners/actions";
import type { BannerActionKind, SiteBanner } from "@/lib/types";

const field =
  "mt-1.5 min-h-11 w-full rounded-sm border border-input bg-bg px-3 py-2.5 text-sm outline-none transition-colors focus:border-signal focus-visible:ring-2 focus-visible:ring-signal/25";
const label = "block text-[0.78rem] font-medium";
const HELP = "mt-1.5 text-[0.73rem] leading-relaxed text-muted-foreground";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);

type Preview = { url: string; type: "image" | "video"; name: string };

function isValidLink(value: string): boolean {
  return (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("https://");
}

export function BannerForm({ banner }: { banner?: SiteBanner }) {
  const [state, formAction, pending] = useActionState<BannerActionState, FormData>(
    saveBannerAction,
    {},
  );
  const [actionKind, setActionKind] = useState<BannerActionKind>(
    banner?.action.kind ?? "button",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileError, setFileError] = useState("");
  const [linkError, setLinkError] = useState("");
  const prefix = banner?.id ?? "new-banner";

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  function chooseFile(file?: File) {
    setFileError("");
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setFileError("Нужен JPG, PNG, WEBP, MP4 или WEBM.");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const limit = (isVideo ? 50 : 20) * 1024 * 1024;
    if (file.size > limit) {
      setFileError(`${isVideo ? "Видео" : "Фото"} больше ${isVideo ? 50 : 20} МБ.`);
      return;
    }
    setPreview({
      url: URL.createObjectURL(file),
      type: isVideo ? "video" : "image",
      name: file.name,
    });
  }

  const mediaUrl = preview?.url ?? (banner ? `/media/${banner.media}` : "");
  const mediaType = preview?.type ?? banner?.mediaType;

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-5">
      {banner && <input type="hidden" name="id" value={banner.id} />}

      <div className="relative aspect-[16/7] min-h-[210px] overflow-hidden rounded-lg border border-border bg-[#111214]">
        {mediaUrl && mediaType === "image" && (
          <Image
            src={mediaUrl}
            alt="Предпросмотр баннера"
            fill
            unoptimized={mediaUrl.startsWith("blob:")}
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 760px"
          />
        )}
        {mediaUrl && mediaType === "video" && (
          <video src={mediaUrl} controls muted playsInline preload="metadata" className="h-full w-full object-contain" />
        )}
        {!mediaUrl && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/55">
            Здесь появится предварительный просмотр файла
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={`${label} md:col-span-2`} htmlFor={`${prefix}-name`}>
          Название в панели
          <input id={`${prefix}-name`} name="name" required maxLength={120} defaultValue={banner?.name} className={field} />
          <span className={HELP}>Служебное название — покупатели его не увидят.</span>
        </label>

        <label className={`${label} md:col-span-2`} htmlFor={`${prefix}-media`}>
          {banner ? "Заменить фото или видео" : "Фото или видео"}
          <input
            id={`${prefix}-media`}
            name="media"
            type="file"
            required={!banner}
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            aria-describedby={`${prefix}-media-help ${fileError ? `${prefix}-media-error` : ""}`}
            onChange={(event) => chooseFile(event.target.files?.[0])}
            className="mt-1.5 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-sm file:border-0 file:bg-signal file:px-4 file:font-semibold file:text-white"
          />
          <span id={`${prefix}-media-help`} className={HELP}>
            JPG, PNG или WEBP до 20 МБ; MP4 или WEBM до 50 МБ. Для широкого баннера лучше 1920×720 или больше.
          </span>
          {fileError && <span id={`${prefix}-media-error`} className="mt-1.5 block text-[0.76rem] text-[var(--signal-text)]">{fileError}</span>}
        </label>

        <label className={`${label} md:col-span-2`} htmlFor={`${prefix}-alt`}>
          Описание фото или видео
          <input id={`${prefix}-alt`} name="alt" maxLength={240} defaultValue={banner?.alt} placeholder="Например: сабвуфер MOMO на тёмном фоне" className={field} />
          <span className={HELP}>Нужно для посетителей, которые не видят изображение. Текст на самой картинке сюда переписывать не нужно.</span>
        </label>

        <label className={label} htmlFor={`${prefix}-theme`}>
          Цвет оформления
          <select id={`${prefix}-theme`} name="theme" defaultValue={banner?.theme ?? "dark"} className={field}>
            <option value="dark">Тёмный</option>
            <option value="light">Светлый</option>
            <option value="signal">Оранжевый MOMO</option>
          </select>
        </label>

        <label className={label} htmlFor={`${prefix}-order`}>
          Порядок
          <input id={`${prefix}-order`} name="order" type="number" min={0} max={9999} step={1} required defaultValue={banner?.order ?? 10} className={field} />
          <span className={HELP}>Меньшее число показывается раньше.</span>
        </label>

        <label className={label} htmlFor={`${prefix}-fit`}>
          Как разместить файл
          <select id={`${prefix}-fit`} name="mediaFit" defaultValue={banner?.mediaFit ?? "cover"} className={field}>
            <option value="cover">На весь баннер с обрезкой</option>
            <option value="contain">Целиком без обрезки</option>
          </select>
        </label>

        <label className={label} htmlFor={`${prefix}-align`}>
          Положение файла
          <select id={`${prefix}-align`} name="mediaAlign" defaultValue={banner?.mediaAlign ?? "center"} className={field}>
            <option value="left">Слева</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </label>
      </div>

      <details className="rounded-lg border border-border bg-bg p-4" open={Boolean(banner?.heading || banner?.description)}>
        <summary className="cursor-pointer font-display text-sm font-bold uppercase">Текст поверх баннера</summary>
        <div className="mt-4 grid gap-4">
          <label className={label} htmlFor={`${prefix}-eyebrow`}>
            Небольшая надпись сверху
            <input id={`${prefix}-eyebrow`} name="eyebrow" maxLength={100} defaultValue={banner?.eyebrow} placeholder="Новинка · уже на складе" className={field} />
          </label>
          <label className={label} htmlFor={`${prefix}-heading`}>
            Заголовок
            <input id={`${prefix}-heading`} name="heading" maxLength={180} defaultValue={banner?.heading} className={field} />
          </label>
          <label className={label} htmlFor={`${prefix}-description`}>
            Описание
            <textarea id={`${prefix}-description`} name="description" rows={3} maxLength={600} defaultValue={banner?.description} className={field} />
          </label>
        </div>
      </details>

      <fieldset className="rounded-lg border border-border bg-bg p-4">
        <legend className="px-1 text-[0.78rem] font-medium">Действие при нажатии</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ["none", "Без ссылки"],
            ["banner", "Весь баннер — ссылка"],
            ["button", "Показать кнопку"],
          ] as const).map(([value, text]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-border px-3 text-sm has-[:checked]:border-signal has-[:checked]:bg-signal/5">
              <input type="radio" name="actionKind" value={value} checked={actionKind === value} onChange={() => { setActionKind(value); setLinkError(""); }} />
              {text}
            </label>
          ))}
        </div>

        {actionKind !== "none" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={`${label} md:col-span-2`} htmlFor={`${prefix}-href`}>
              Ссылка
              <input
                id={`${prefix}-href`}
                name="href"
                type="text"
                required
                maxLength={1000}
                defaultValue={banner?.action.href}
                placeholder="/catalog или https://example.ru/page"
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? `${prefix}-href-error` : undefined}
                onBlur={(event) => setLinkError(isValidLink(event.target.value.trim()) ? "" : "Начните адрес с / или https://")}
                className={field}
              />
              {linkError && <span id={`${prefix}-href-error`} className="mt-1.5 block text-[0.76rem] text-[var(--signal-text)]">{linkError}</span>}
            </label>
            {actionKind === "button" && (
              <label className={label} htmlFor={`${prefix}-button-label`}>
                Текст кнопки
                <input id={`${prefix}-button-label`} name="buttonLabel" required maxLength={80} defaultValue={banner?.action.label} placeholder="Смотреть товары" className={field} />
              </label>
            )}
            <label className="flex min-h-11 items-center gap-2 text-[0.82rem] md:self-end">
              <input type="checkbox" name="newTab" defaultChecked={banner?.action.newTab} />
              Открывать в новой вкладке
            </label>
          </div>
        )}
      </fieldset>

      <label className="flex min-h-11 items-center gap-2 text-[0.85rem]">
        <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} />
        Показывать баннер на главной
      </label>

      {(state.error || fileError || linkError) && (
        <p role="alert" className="rounded-sm border border-[var(--signal-text)] bg-signal/5 px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error || fileError || linkError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || Boolean(fileError) || Boolean(linkError)}
        className="min-h-11 rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
      >
        {pending ? "Сохраняю…" : banner ? "Сохранить баннер" : "Добавить баннер"}
      </button>
    </form>
  );
}

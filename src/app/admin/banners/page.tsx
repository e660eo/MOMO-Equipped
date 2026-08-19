import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { BannerForm } from "@/components/admin/banner-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdminPage } from "@/lib/admin-auth";
import { bannerLayout } from "@/lib/banner-layout";
import { getBanners } from "@/lib/banners";
import type { SiteBanner } from "@/lib/types";
import { deleteBannerAction } from "./actions";

function BannerThumb({ banner }: { banner: SiteBanner }) {
  const src = `/media/${banner.media}`;
  return (
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[#111214] sm:h-20 sm:w-32">
      {banner.mediaType === "image" ? (
        <Image src={src} alt="" fill className="object-contain" sizes="128px" />
      ) : (
        <video src={src} muted preload="metadata" className="h-full w-full object-contain" />
      )}
    </div>
  );
}

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const banners = getBanners();
  const active = banners.filter((banner) => banner.active).length;

  return (
    <div>
      <div>
        <h1 className="font-display text-xl font-extrabold uppercase">Баннеры</h1>
        <p className="mt-1 max-w-[70ch] text-[0.85rem] leading-relaxed text-muted-foreground">
          Фото и видео для карусели на главной. Можно сделать весь баннер ссылкой или добавить отдельную кнопку.
        </p>
        <p className="mt-2 text-[0.78rem] text-muted-foreground">
          Опубликовано: {active} из {banners.length}. Изменения появляются на сайте сразу после сохранения.
        </p>
      </div>

      {(params.saved || params.deleted) && (
        <p className="mt-5 rounded-sm border border-green-600/30 bg-green-600/5 px-4 py-3 text-sm text-green-700">
          {params.deleted ? "Баннер удалён." : "Баннер сохранён и главная обновлена."}
        </p>
      )}

      <details className="mt-6 rounded-xl border border-signal/45 bg-surface p-5" open={banners.length === 0}>
        <summary className="min-h-11 cursor-pointer content-center font-display text-base font-extrabold uppercase">
          Добавить баннер
        </summary>
        <div className="mt-5 border-t border-border pt-5">
          <BannerForm />
        </div>
      </details>

      <div className="mt-8 grid gap-4">
        {banners.map((banner) => (
          <details key={banner.id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <summary className="min-h-20 cursor-pointer list-none">
              <div className="flex items-center gap-4">
                <BannerThumb banner={banner} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-sm font-bold uppercase sm:text-base">{banner.name}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] ${banner.active ? "border-green-600/35 text-green-700" : "border-border text-muted-foreground"}`}>
                      {banner.active ? "на сайте" : "скрыт"}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                      {banner.mediaType === "video" ? "видео" : "фото"}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                      {bannerLayout(banner) === "artwork" ? "готовый дизайн" : "собран на сайте"}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.75rem] text-muted-foreground">
                    Порядок {banner.order} · {banner.action.kind === "button" ? "кнопка" : banner.action.kind === "banner" ? "активная ссылка" : "без ссылки"}
                  </p>
                </div>
                <ChevronDown aria-hidden size={18} className="shrink-0 text-muted-foreground" />
              </div>
            </summary>
            <div className="mt-5 border-t border-border pt-5">
              <BannerForm banner={banner} />
              <form action={deleteBannerAction} className="mt-4 border-t border-border pt-4">
                <input type="hidden" name="id" value={banner.id} />
                <ConfirmButton label="Удалить баннер" question={`Удалить баннер «${banner.name}» и загруженный для него файл?`} />
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

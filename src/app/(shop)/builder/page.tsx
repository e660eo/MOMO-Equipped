import type { Metadata } from "next";
import { AudioSystemBuilder } from "@/components/audio-system-builder";
import { getProducts, siteConfig } from "@/lib/data";
import { publicPageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = publicPageMetadata(
  "Собрать аудиосистему",
  "Подбор автоакустики MOMO и ZEUS по характеру звука, размеру динамиков и бюджету. Готовую систему можно добавить в корзину одним нажатием.",
  "/builder",
);

export default function AudioSystemBuilderPage() {
  const products = getProducts().map(({ slug, title, price, image, category, description, inStock, stock }) => ({
    slug,
    title,
    price,
    image,
    category,
    description,
    inStock,
    stock,
  }));

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_260px_at_74%_15%,rgba(255,85,0,.12),transparent_68%)]" />
        <div className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-signal">Конструктор системы</p>
          <h1 className="mt-4 max-w-[820px] font-display text-[clamp(2rem,5vw,4.5rem)] font-black uppercase leading-[0.94] tracking-[-0.025em]">
            Соберите звук <span className="text-signal">под себя</span>
          </h1>
          <p className="mt-5 max-w-[64ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
            Три вопроса — и алгоритм сопоставит товары каталога по RMS, сопротивлению и каналам усиления. Цены и наличие учитываются прямо сейчас.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <AudioSystemBuilder products={products} whatsapp={siteConfig.contacts.whatsapp} />
        <p className="mx-auto mt-6 max-w-[82ch] text-center text-xs leading-relaxed text-muted-foreground">
          Конструктор делает предварительный подбор оборудования. Импеданс, питание, объём короба, штатные посадочные места и объём монтажных работ нужно подтвердить для конкретного автомобиля.
        </p>
      </section>
    </main>
  );
}

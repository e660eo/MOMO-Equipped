import type { Metadata } from "next";
import { ListeningStand } from "@/components/listening-stand";
import { getProducts } from "@/lib/data";
import { isListeningStandProduct } from "@/lib/listening-stand";

export const metadata: Metadata = {
  title: "Онлайн-стенд автозвука MOMO и ZEUS",
  description:
    "Слушайте записи динамиков MOMO и ZEUS, сравнивайте характер звучания и выбирайте автомобильную акустику.",
  alternates: { canonical: "/listening-stand" },
  openGraph: {
    title: "Онлайн-стенд MOMO и ZEUS",
    description: "Сравнение автомобильной акустики MOMO и ZEUS по единым записям и экспертным оценкам.",
    url: "/listening-stand",
    type: "website",
  },
};

export default function ListeningStandPage() {
  const products = getProducts()
    .filter(isListeningStandProduct)
    .sort((a, b) => {
      const byRecording = Number(Boolean(b.listening?.published && b.listening.audio)) - Number(Boolean(a.listening?.published && a.listening.audio));
      return byRecording || a.title.localeCompare(b.title, "ru");
    });

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-[#111214] px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12">
        <div aria-hidden className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[46px] border-[#ff5500]/10" />
        <div aria-hidden className="absolute bottom-0 right-10 hidden h-px w-[38%] bg-gradient-to-r from-transparent via-[#ff5500] to-transparent sm:block" />
        <div className="relative max-w-[760px]">
          <p className="font-label text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#ff7b39]">MOMO listening bench</p>
          <h1 className="mt-4 font-display text-[clamp(2rem,6vw,4.4rem)] font-black uppercase leading-[0.96] tracking-[-0.055em]">
            Услышьте характер<br /><span className="text-[#ff5500]">до установки</span>
          </h1>
          <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-white/62 sm:text-base">
            Онлайн-стенд с продукцией MOMO и ZEUS. Запись каждой модели
            публикуется только после съёмки в одинаковых условиях, чтобы
            сравнение оставалось честным.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/45">
            <span>{products.length} моделей</span>
            <span>Одна методика записи</span>
            <span>Лучше слушать в наушниках</span>
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-[16px] border border-signal/20 bg-signal/[0.055] px-4 py-3 text-[0.75rem] leading-relaxed text-muted-foreground sm:px-5">
        Онлайн-запись помогает сравнить характер моделей, но не воспроизводит
        звучание в конкретном автомобиле: на результат влияют салон, установка,
        усилитель, источник и ваши наушники.
      </div>

      <ListeningStand products={products} />
    </main>
  );
}

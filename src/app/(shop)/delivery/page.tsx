import type { Metadata } from "next";
import Link from "next/link";
import { Store, Truck, CreditCard, Undo2 } from "lucide-react";
import { siteConfig, formatPrice } from "@/lib/data";

export const metadata: Metadata = {
  title: "Доставка и оплата",
  description:
    "Как получить заказ MOMO: самовывоз в Махачкале, доставка по всей России (СДЭК, Почта России, транспортные компании), бесплатно от 5 000 ₽. Оплата и сплит без процентов.",
};

/*
  Конкретные тарифы и сроки служб доставки здесь НЕ выдумываем: они зависят
  от региона и габаритов (сабвуфер — это большая тяжёлая коробка), поэтому
  точную сумму и срок называет менеджер при подтверждении заказа — до оплаты.
  Появятся фиксированные тарифы — впишем.
*/
export default function DeliveryPage() {
  const { contacts, trust } = siteConfig;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Покупателям
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold uppercase leading-tight">
        Доставка и оплата
      </h1>
      <p className="mt-4 max-w-[60ch] text-[1.02rem] leading-relaxed text-muted-foreground">
        Заказ из корзины уходит менеджеру в WhatsApp — он подтверждает состав,
        считает доставку и отвечает на вопросы в течение{" "}
        {trust.processingDays === 1 ? "рабочего дня" : `${trust.processingDays} дней`}.
        Точную стоимость доставки вы узнаёте до оплаты.
      </p>

      {/* Получение */}
      <section className="mt-12">
        <h2 className="font-display text-lg font-extrabold uppercase">
          Как получить заказ
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6">
            <Store size={20} className="text-signal" />
            <h3 className="mt-3 font-display text-base font-semibold">
              Самовывоз — бесплатно
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {contacts.address}. {contacts.hours}. Покажем товар до покупки,
              поможем с подбором и подключением.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <Truck size={20} className="text-signal" />
            <h3 className="mt-3 font-display text-base font-semibold">
              Доставка по всей России
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Отправляем СДЭК, Почтой России или транспортной компанией — до
              двери или до пункта выдачи. Способ выбираете вы, согласуем при
              подтверждении заказа.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-6">
          <p className="text-sm leading-relaxed">
            <b className="font-semibold">
              Заказы от {formatPrice(trust.freeShippingFrom)} доставляем
              бесплатно.
            </b>{" "}
            <span className="text-muted-foreground">
              Для заказов меньшей суммы доставка — по тарифу выбранной службы:
              он зависит от региона и габаритов, менеджер называет точную сумму
              до оплаты. Срок в пути зависит от службы и адреса — ориентир по
              вашему городу менеджер сообщает при подтверждении заказа.
            </span>
          </p>
        </div>
      </section>

      {/* Оплата */}
      <section className="mt-12">
        <h2 className="font-display text-lg font-extrabold uppercase">
          Оплата
        </h2>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <CreditCard size={20} className="text-signal" />
            <h3 className="mt-3 font-display text-base font-semibold">
              После подтверждения заказа
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Менеджер пришлёт удобные способы оплаты в WhatsApp — оплачиваете
              только подтверждённый заказ с известной суммой доставки.
              Онлайн-оплата картой прямо на сайте подключается — появится в
              ближайших обновлениях.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="font-display text-base font-semibold">
              Сплит — 4 платежа без процентов
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Забирайте комплект сейчас, платите по четверти суммы раз в две
              недели, без процентов и переплат. Оформление — через менеджера
              при подтверждении заказа.
            </p>
          </div>
        </div>
      </section>

      {/* Возврат и гарантия */}
      <section className="mt-12">
        <h2 className="font-display text-lg font-extrabold uppercase">
          Возврат и гарантия
        </h2>
        <div className="mt-5 rounded-xl border border-border bg-surface p-6">
          <Undo2 size={20} className="text-signal" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            На всё оборудование действует гарантия{" "}
            <b className="font-semibold text-foreground">
              {trust.warrantyMonths} месяцев
            </b>
            . Вернуть или обменять товар надлежащего качества можно в течение{" "}
            <b className="font-semibold text-foreground">
              {trust.returnDays} дней
            </b>{" "}
            с момента получения — в заводской упаковке и без следов установки.
            Закон «О защите прав потребителей» даёт на это 14 дней при покупке в
            магазине (ст. 25) и 7 дней при заказе с доставкой (ст. 26.1) — мы
            держим {trust.returnDays} дней в обоих случаях. По гарантийному
            случаю напишите нам — решим вопрос ремонтом, заменой или возвратом
            денег.
          </p>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <a
          href={contacts.whatsapp}
          className="inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          Задать вопрос о доставке
        </a>
        <Link
          href="/catalog"
          className="inline-flex rounded-sm border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          Открыть каталог
        </Link>
      </div>
    </main>
  );
}

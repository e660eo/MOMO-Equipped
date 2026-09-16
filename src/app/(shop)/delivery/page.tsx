import type { Metadata } from "next";
import Link from "next/link";
import { Store, Truck, CreditCard, Undo2 } from "lucide-react";
import { siteConfig, formatPrice } from "@/lib/data";
import { publicPageMetadata } from "@/lib/seo-metadata";
import { OZON_DELIVERY_SURCHARGE } from "@/lib/delivery-pricing";

export const metadata: Metadata = publicPageMetadata(
  "Доставка и оплата",
  "Как получить заказ MOMO: самовывоз в Махачкале, доставка по всей России через Ozon, бесплатно от 5 000 ₽. Оплата и сплит без процентов.",
  "/delivery",
);

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
        Выберите в корзине пункт Ozon и оплатите заказ картой или Сплитом.
        Доставка бесплатна от {formatPrice(trust.freeShippingFrom)}, для заказов
        меньшей суммы — {formatPrice(OZON_DELIVERY_SURCHARGE)}. Итоговая сумма
        видна до оплаты. Порог бесплатной доставки считается по стоимости товаров до промокода и списания бонусов, с учётом цены готового комплекта. Отправление создаётся только после успешной оплаты.
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
              Отправляем в выбранный пункт выдачи Ozon. Сайт покажет ближайшие
              пункты и проверит доступность маршрута до перехода к оплате.
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
              Для заказов меньшей суммы доставка до пункта выдачи Ozon стоит{" "}
              {formatPrice(OZON_DELIVERY_SURCHARGE)} и добавляется к сумме в корзине.
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
              Картой или через Яндекс Сплит
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Онлайн-оплата доступна для заказов с доставкой Ozon независимо от
              суммы. Перед оплатой войдите в аккаунт и подтвердите почту.
              Оплата проходит на защищённой странице Яндекс Pay,
              а электронный чек формирует подключённая онлайн-касса.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="font-display text-base font-semibold">
              Сплит — 4 платежа без процентов
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Забирайте комплект сейчас, платите по четверти суммы раз в две
              недели, без процентов и переплат. Выберите Сплит на странице
              Яндекс Pay после нажатия «Оплатить на сайте».
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
            На всё оборудование действует стандартная гарантия{" "}
            <b className="font-semibold text-foreground">
              {trust.warrantyMonths} месяцев
            </b>
            . При установке в авторизованном центре MOMO/ZEUS гарантия составляет{" "}
            <b className="font-semibold text-foreground">
              {trust.extendedWarrantyMonths} месяца
            </b>
            . Вернуть или обменять товар надлежащего качества можно в течение{" "}
            <b className="font-semibold text-foreground">
              {trust.returnDays} дней
            </b>{" "}
            с момента получения — в заводской упаковке и без следов установки.
            Это дополнительные условия магазина; они не ограничивают права покупателя по закону. Для дистанционной покупки закон предусматривает отказ до передачи товара и в течение 7 дней после получения при сохранении товарного вида и потребительских свойств. По гарантийному
            случаю напишите нам — решим вопрос ремонтом, заменой или возвратом
            денег.
          </p>
          <h3 className="mt-6 font-semibold">Как оформить возврат или обратиться по гарантии</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Свяжитесь с нами через раздел «Контакты». Укажите номер заказа или дату покупки, модель и причину обращения. При неисправности приложите описание и, если возможно, фотографии.</li>
            <li>Согласуйте с поддержкой адрес и способ передачи товара. Для гарантийного обращения подготовьте документы о покупке и установке; отсутствие чека само по себе не лишает права подтвердить покупку другим способом.</li>
            <li>Защитите товар при перевозке и сохраните подтверждение отправки. Для возврата качественного товара при дистанционной покупке срок возврата денег — не позднее 10 дней со дня требования; расходы на обратную доставку могут быть вычтены. Порядок проверки неисправного товара согласуем отдельно в рамках закона.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Подробнее о правах при дистанционной покупке — <a className="underline" href="https://zpp.rospotrebnadzor.ru/news/federal/575008" target="_blank" rel="noopener noreferrer">разъяснение Роспотребнадзора</a>.</p>
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

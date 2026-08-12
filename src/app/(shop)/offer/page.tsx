import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig, formatPrice } from "@/lib/data";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description:
    "Договор розничной купли-продажи интернет-магазина MOMO (ИП Махмудов З.Ф.): оформление заказа, цена и оплата, доставка через Ozon, возврат и гарантия.",
};

// Дата редакции. Менять при правках оферты.
const REVISION = "27 июля 2026 года";

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 scroll-mt-24">
      <h2 className="font-display text-lg font-extrabold uppercase leading-snug">
        <span className="mr-3 text-signal">{n}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[0.94rem] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 border-l border-border pl-5">
      {items.map((item, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-5 top-[0.62em] h-px w-3 bg-border" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function OfferPage() {
  const { contacts, trust, requisites: r } = siteConfig;
  const processing =
    trust.processingDays === 1
      ? "одного рабочего дня"
      : `${trust.processingDays} рабочих дней`;

  return (
    <main className="mx-auto max-w-[840px] px-6 py-14">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Договор розничной купли-продажи · публичная оферта
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold uppercase leading-tight">
        Публичная оферта
      </h1>
      <p className="mt-4 max-w-[62ch] text-[1.02rem] leading-relaxed text-muted-foreground">
        Документ описывает условия покупки товаров в интернет-магазине{" "}
        {siteConfig.name}: как оформляется заказ, как он оплачивается и
        доставляется, как вернуть товар и что с гарантией.
      </p>
      <p className="mt-5 font-label text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Редакция от {REVISION}
      </p>

      <Section n="01" title="Общие положения">
        <p>
          Настоящий документ — публичная оферта <b>{r.fullName}</b> (ИНН{" "}
          <b className="tabular-nums">{r.inn}</b>, ОГРНИП{" "}
          <b className="tabular-nums">{r.ogrnip}</b>), далее «Продавец»,
          адресованная любому дееспособному физическому лицу («Покупатель»),
          заключить договор розничной купли-продажи товаров, представленных в
          интернет-магазине {siteConfig.name} по адресу{" "}
          {r.website.replace(/^https?:\/\//, "")}, на изложенных ниже условиях.
        </p>
        <p>
          В соответствии со ст. 435 и 437 Гражданского кодекса РФ документ
          является публичной офертой. Оформление заказа на Сайте признаётся
          акцептом оферты (ст. 438 ГК РФ) — с этого момента договор считается
          заключённым на условиях настоящей оферты.
        </p>
      </Section>

      <Section n="02" title="Термины">
        <List
          items={[
            <>
              <b>Продавец</b> — {r.fullName}.
            </>,
            <>
              <b>Покупатель</b> — физическое лицо, оформившее заказ на Сайте.
            </>,
            <>
              <b>Товар</b> — автоакустика и сопутствующие товары, представленные
              в каталоге Сайта.
            </>,
            <>
              <b>Заказ</b> — оформленный Покупателем запрос на приобретение
              выбранных Товаров.
            </>,
          ]}
        />
      </Section>

      <Section n="03" title="Предмет договора">
        <p>
          Продавец обязуется передать Товар в собственность Покупателю, а
          Покупатель — принять и оплатить его на условиях настоящей оферты.
          Наименование, характеристики и цена Товара указаны в его карточке на
          Сайте.
        </p>
        <p>
          Фотографии и описания носят информационный характер; незначительные
          отличия внешнего вида поставленного Товара от изображения на Сайте не
          являются недостатком.
        </p>
      </Section>

      <Section n="04" title="Оформление заказа">
        <p>
          Покупатель формирует Заказ в корзине Сайта. Заказ можно оплатить на
          Сайте либо передать менеджеру через WhatsApp для согласования наличия,
          состава и итоговой суммы в течение {processing}. Неоплаченный
          онлайн-заказ не передаётся Продавцу на обработку.
        </p>
        <p>
          Договор считается заключённым после успешной онлайн-оплаты либо с
          момента подтверждения Заказа менеджером и согласования Покупателем
          итоговой суммы. Оформляя Заказ, Покупатель
          подтверждает, что ознакомлен и согласен с условиями настоящей оферты и{" "}
          <Link
            href="/privacy"
            className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
          >
            Политикой конфиденциальности
          </Link>
          .
        </p>
      </Section>

      <Section n="05" title="Цена и оплата">
        <p>
          Цены на Товар указаны на Сайте в рублях РФ. Итоговая сумма Заказа
          показывается Покупателю до оплаты.
        </p>
        <List
          items={[
            "на Сайте доступна онлайн-оплата банковской картой через Яндекс Pay;",
            "Сплит (4 платежа без процентов) можно выбрать на платёжной странице Яндекс Pay;",
            "для заказов, оформляемых через WhatsApp, способы и срок оплаты сообщает Продавец после согласования.",
          ]}
        />
      </Section>

      <Section n="06" title="Доставка и получение">
        <p>Способ получения Покупатель выбирает при оформлении Заказа:</p>
        <List
          items={[
            <>
              <b>Самовывоз</b> — бесплатно, {contacts.address} ({contacts.hours}
              ).
            </>,
            <>
              <b>Доставка по России — через сервис Ozon</b> в выбранный пункт
              выдачи. Для онлайн-заказа доступность маршрута проверяется на
              Сайте до оплаты, а отправление создаётся после подтверждения
              оплаты.
            </>,
          ]}
        />
        <p>
          Заказы на сумму от {formatPrice(trust.freeShippingFrom)} доставляются
          бесплатно. Для меньшей суммы стоимость доставки согласовывается с
          менеджером до оплаты. Право собственности и риск случайной гибели Товара переходят
          к Покупателю с момента получения Товара им или его представителем.
        </p>
      </Section>

      <Section n="07" title="Возврат и обмен">
        <p>
          Покупатель вправе отказаться от Товара надлежащего качества в течение{" "}
          <b>{trust.returnDays} дней</b> с момента получения при условии, что
          сохранены товарный вид, потребительские свойства, заводская упаковка и
          отсутствуют следы установки и эксплуатации.
        </p>
        <p>
          Основания и порядок возврата установлены Законом РФ «О защите прав
          потребителей»: ст. 25 (14 дней при покупке в магазине) и ст. 26.1 (7
          дней при дистанционной продаже). Продавец добровольно удерживает срок{" "}
          {trust.returnDays} дней в обоих случаях. Возврат уплаченной суммы
          производится в срок, установленный законом.
        </p>
        <p>
          Товар ненадлежащего качества принимается по гарантии: по выбору в
          соответствии с законом — ремонт, замена или возврат денежных средств.
        </p>
      </Section>

      <Section n="08" title="Гарантия">
        <p>
          На оборудование действует гарантия <b>{trust.warrantyMonths} месяцев</b>{" "}
          с момента получения Товара, если иной гарантийный срок не указан в
          карточке Товара или в гарантийном талоне производителя.
        </p>
      </Section>

      <Section n="09" title="Персональные данные">
        <p>
          Обработка персональных данных Покупателя осуществляется в соответствии
          с{" "}
          <Link
            href="/privacy"
            className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
          >
            Политикой конфиденциальности
          </Link>{" "}
          и на основании согласия, которое Покупатель даёт при оформлении Заказа.
        </p>
      </Section>

      <Section n="10" title="Ответственность сторон">
        <p>
          Стороны несут ответственность в соответствии с законодательством РФ.
          Продавец не отвечает за нарушение сроков доставки, произошедшее по вине
          службы доставки, а также за последствия предоставления Покупателем
          неверных или неполных данных при оформлении Заказа.
        </p>
        <p>
          По вопросам, не урегулированным настоящей офертой, стороны
          руководствуются законодательством Российской Федерации.
        </p>
      </Section>

      <Section n="11" title="Реквизиты Продавца">
        <List
          items={[
            <>
              <b>{r.fullName}</b>
            </>,
            <>
              ИНН <span className="tabular-nums">{r.inn}</span>, ОГРНИП{" "}
              <span className="tabular-nums">{r.ogrnip}</span>
            </>,
            <>Адрес: {r.postalAddress}</>,
            <>
              E-mail:{" "}
              <a
                href={`mailto:${contacts.email}`}
                className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
              >
                {contacts.email}
              </a>
              , телефон:{" "}
              <a
                href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`}
                className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
              >
                {contacts.phone}
              </a>
            </>,
          ]}
        />
        <p>
          Полные реквизиты, включая банковские, — на странице{" "}
          <Link
            href="/requisites"
            className="text-[var(--signal-text)] underline underline-offset-4 hover:no-underline"
          >
            «Реквизиты»
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}

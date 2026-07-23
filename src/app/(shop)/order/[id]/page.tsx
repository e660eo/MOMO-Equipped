import Link from "next/link";
import crypto from "node:crypto";
import type { Metadata } from "next";
import { getOrder } from "@/lib/orders";
import { fetchPaymentStatus, isPaid, PAYMENT_LABELS } from "@/lib/yandex-pay";
import { updatePaymentStatus } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { safeHref } from "@/lib/sanitize";
import type { PaymentStatus } from "@/lib/types";

/*
  Страница возврата с оплаты: сюда Яндекс Пэй приводит покупателя, когда тот
  расплатился или передумал.

  Чужой заказ здесь открыть нельзя. Номер (2207-001) подбирается перебором за
  минуту, поэтому показываем что-либо только по случайной метке из ссылки —
  её знает лишь тот, кто эту оплату начинал.

  Статус спрашиваем у Яндекса прямо тут, а не ждём вебхука: покупатель
  возвращается сразу и должен увидеть ответ, а не «ожидает оплаты».
*/

export const metadata: Metadata = {
  title: "Заказ",
  // Страница с чужими данными в поиске не нужна ни нам, ни покупателю.
  robots: { index: false, follow: false },
};

/** Сравнение меток без утечки времени: побайтовый разбор выдаёт длину префикса. */
function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; error?: string }>;
}) {
  const { id } = await params;
  const { t = "", error } = await searchParams;

  const order = getOrder(id);
  const token = order?.payment?.token;
  const allowed = Boolean(token && t && sameToken(token, t));

  if (!order || !allowed) {
    return (
      <main className="mx-auto max-w-[560px] px-6 py-20">
        <h1 className="font-display text-2xl font-extrabold uppercase">
          Заказ не найден
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Ссылка устарела или в ней ошибка. Если вы оплачивали заказ, напишите
          нам — найдём по номеру и подтвердим.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
        >
          На главную
        </Link>
      </main>
    );
  }

  /*
    Свежий статус. Если Яндекс не ответил, показываем то, что записано у нас,
    — врать про оплату нельзя ни в одну сторону.
  */
  let status: PaymentStatus = order.payment?.status ?? "none";
  try {
    const fresh = await fetchPaymentStatus(id);
    if (fresh) {
      updatePaymentStatus(id, fresh);
      status = fresh;
    }
  } catch {
    // Оставляем сохранённый статус: вебхук всё равно догонит.
  }

  const paid = isPaid(status);
  const failed = status === "FAILED" || status === "VOIDED";
  const sum = formatPrice(order.payment?.amount ?? order.total);

  return (
    <main className="mx-auto max-w-[560px] px-6 py-20">
      {paid ? (
        <>
          <h1 className="font-display text-2xl font-extrabold uppercase">
            Заказ оплачен
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Спасибо! Заказ <b className="font-mono text-foreground">№{order.id}</b>{" "}
            на сумму <b className="text-foreground">{sum}</b> оплачен. Менеджер
            свяжется с вами в рабочее время, чтобы согласовать доставку.
          </p>
          {order.payment?.sandbox && (
            <p className="mt-4 rounded-sm border border-border px-4 py-3 text-[0.85rem] text-muted-foreground">
              Это тестовая оплата — настоящие деньги не списывались.
            </p>
          )}
        </>
      ) : failed || error ? (
        <>
          <h1 className="font-display text-2xl font-extrabold uppercase">
            Оплата не прошла
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Заказ <b className="font-mono text-foreground">№{order.id}</b> мы
            сохранили, деньги не списаны. Можно попробовать оплатить ещё раз
            или написать нам — оформим без оплаты на сайте.
          </p>
          {order.payment?.url && (
            <a
              href={safeHref(order.payment.url)}
              className="mt-6 inline-flex rounded-sm bg-signal px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Попробовать снова
            </a>
          )}
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-extrabold uppercase">
            Оплата обрабатывается
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Заказ <b className="font-mono text-foreground">№{order.id}</b> на{" "}
            {sum} — {PAYMENT_LABELS[status].toLowerCase()}. Обновите страницу
            через минуту: банк ещё подтверждает платёж.
          </p>
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className="rounded-sm border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          В каталог
        </Link>
        <Link
          href="/profile"
          className="rounded-sm border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
        >
          Мои заказы
        </Link>
      </div>
    </main>
  );
}

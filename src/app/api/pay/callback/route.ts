import { NextResponse } from "next/server";
import {
  verifyWebhook,
  fetchPaymentStatus,
  isPayConfigured,
  isPaid,
} from "@/lib/yandex-pay";
import { getOrder, updatePaymentStatus } from "@/lib/orders";
import { notifyPaidOrder } from "@/lib/order-mail";

/*
  Уведомление Яндекс Пэй о смене состояния платежа.

  Порядок проверок здесь важнее краткости:

  1. Подпись. Тело — JWT, подписанный ключом Яндекса. Адрес вебхука не
     секрет, так что без подписи любой мог бы отметить заказ оплаченным.
  2. Перезапрос. Даже с верной подписью статус берём не из письма, а
     запросом к API по номеру заказа: письмо говорит «посмотри», а не «верь».

  Отвечаем 200 на всё, что разобрали, даже если заказа у нас нет: иначе
  Яндекс будет слать повторы вечно. А вот на неразобранное отвечаем ошибкой —
  пусть повторит.
*/

export async function POST(request: Request) {
  if (!isPayConfigured()) {
    return NextResponse.json({ error: "payments disabled" }, { status: 503 });
  }

  const raw = (await request.text()).trim();
  if (!raw) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  /*
    Тело приходит либо голым JWT, либо объектом с полем внутри — принимаем
    оба вида, чтобы смена формата на стороне Яндекса не роняла приём денег.
  */
  let token = raw;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const found = ["jwt", "token", "data", "body"]
        .map((key) => parsed[key])
        .find((value) => typeof value === "string");
      if (typeof found === "string") token = found;
    } catch {
      // неJSON — оставляем как есть, ниже разберёт проверка подписи
    }
  }

  let orderId: string | undefined;
  try {
    const payload = await verifyWebhook(token);
    orderId = payload.order?.orderId ?? payload.orderId;
  } catch (e) {
    // Подпись не сошлась — это не «сбой», это чужой запрос. В лог и 400.
    console.error("Яндекс Пэй: уведомление отклонено —", e);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  if (!orderId) {
    console.error("Яндекс Пэй: в уведомлении нет номера заказа");
    return NextResponse.json({ ok: true });
  }

  const order = getOrder(orderId);
  if (!order) {
    console.error(`Яндекс Пэй: заказ ${orderId} не найден`);
    return NextResponse.json({ ok: true });
  }

  let status;
  try {
    status = await fetchPaymentStatus(orderId);
  } catch (e) {
    // API недоступен — просим повторить позже, статус не выдумываем.
    console.error(`Яндекс Пэй: не смогли проверить заказ ${orderId}`, e);
    return NextResponse.json({ error: "retry later" }, { status: 502 });
  }

  if (!status) {
    console.error(`Яндекс Пэй: незнакомый статус заказа ${orderId}`);
    return NextResponse.json({ ok: true });
  }

  const changed = updatePaymentStatus(orderId, status);

  // Письмо об оплате — только на переход в «оплачен» и только один раз:
  // повторные уведомления о том же статусе ничего не меняют.
  if (changed && isPaid(status)) {
    const fresh = getOrder(orderId);
    if (fresh) void notifyPaidOrder(fresh);
  }

  return NextResponse.json({ ok: true });
}

"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { saveDealerAgreementAction, type DealerAgreementState } from "@/app/admin/dealers/orders/[id]/actions";
import type { DealerOrderAgreement } from "@/lib/dealer-order-management";
import { formatPrice } from "@/lib/format";
import type { DealerOrder } from "@/lib/types";

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal";

export function DealerOrderAgreementForm({ order, agreement }: { order: DealerOrder; agreement?: DealerOrderAgreement }) {
  const [state, action, pending] = useActionState<DealerAgreementState, FormData>(saveDealerAgreementAction, {});
  const [initialRevision] = useState(agreement?.revision ?? 0);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const quantity = new Map(agreement?.items.map((item) => [item.slug, item.qty]));
    return {
      ...Object.fromEntries(order.items.map((item) => [`qty:${item.slug}`, String(agreement ? quantity.get(item.slug) ?? 0 : item.qty)])),
      deliveryMethod: agreement?.deliveryMethod ?? "", deliveryCost: String(agreement?.deliveryCost ?? 0), deliveryAddress: agreement?.deliveryAddress ?? "",
      paymentStatus: agreement?.paymentStatus ?? "unpaid", invoiceReference: agreement?.invoiceReference ?? "", paymentTerms: agreement?.paymentTerms ?? "",
      trackingNumber: agreement?.trackingNumber ?? "", trackingUrl: agreement?.trackingUrl ?? "", managerMessage: agreement?.managerMessage ?? "",
    };
  });
  const bind = (name: string) => ({
    value: fields[name] ?? "", disabled: pending,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFields((current) => ({ ...current, [name]: event.target.value })),
  });
  const invoiceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.ok && invoiceInput.current) invoiceInput.current.value = "";
  }, [state]);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="revision" value={state.revision ?? initialRevision} />
      <div>
        <h2 className="font-display text-xl font-extrabold uppercase">Согласованные условия</h2>
        <p className="mt-1 text-sm text-muted-foreground">Укажите подтверждённое количество и условия после согласования с дилером. Ноль исключает позицию. Исходная заявка сохраняется отдельно.</p>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {order.items.map((item) => <label key={item.slug} className="grid grid-cols-[minmax(0,1fr)_90px] items-center gap-4 p-4"><span className="min-w-0"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">Заказано: {item.qty} шт. · {formatPrice(item.price)} / шт.</span></span><span><span className="text-xs text-muted-foreground">Подтверждено</span><input name={`qty:${item.slug}`} type="number" min="0" max="999" step="1" required {...bind(`qty:${item.slug}`)} className={inputClass} aria-label={`Количество: ${item.title}`} /></span></label>)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Способ доставки<input name="deliveryMethod" maxLength={200} {...bind("deliveryMethod")} placeholder="Транспортная компания или самовывоз" className={inputClass} /></label>
        <label className="text-sm font-semibold">Стоимость доставки, ₽<input name="deliveryCost" type="number" min="0" max="10000000" step="0.01" required {...bind("deliveryCost")} className={inputClass} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Адрес / пункт выдачи<textarea name="deliveryAddress" maxLength={1200} {...bind("deliveryAddress")} rows={2} className={inputClass} /></label>
        <label className="text-sm font-semibold">Оплата<select name="paymentStatus" {...bind("paymentStatus")} className={inputClass}><option value="unpaid">Ожидается оплата</option><option value="partial">Оплачен частично</option><option value="paid">Оплачен</option></select></label>
        <label className="text-sm font-semibold">Номер и дата счёта<input name="invoiceReference" maxLength={300} {...bind("invoiceReference")} placeholder="Например: № 123 от 25.09.2026" className={inputClass} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Файл счёта, PDF до 5 МБ<input ref={invoiceInput} disabled={pending} name="invoiceFile" type="file" accept=".pdf,application/pdf" className={inputClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Доступен только этому дилеру и администратору. Новый файл заменяет счёт в текущих условиях.</span>{agreement?.invoiceFile && <a href={`/dealer/orders/${encodeURIComponent(order.id)}/invoice`} className="mt-2 inline-block text-sm font-semibold text-signal underline">Скачать текущий счёт: {agreement.invoiceFile.originalName}</a>}</label>
        <label className="text-sm font-semibold sm:col-span-2">Условия оплаты / реквизиты<textarea name="paymentTerms" maxLength={1500} {...bind("paymentTerms")} rows={3} className={inputClass} /></label>
        <label className="text-sm font-semibold">Трек-номер<input name="trackingNumber" maxLength={200} {...bind("trackingNumber")} className={inputClass} /></label>
        <label className="text-sm font-semibold">Ссылка отслеживания<input name="trackingUrl" type="url" maxLength={1000} {...bind("trackingUrl")} placeholder="https://" className={inputClass} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Сообщение дилеру<textarea name="managerMessage" maxLength={3000} {...bind("managerMessage")} rows={4} className={inputClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Текст будет виден в кабинете и в письме об обновлении условий.</span></label>
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Условия сохранены, версия {state.revision}. {state.warning ?? "Письмо дилеру поставлено в очередь."}</p>}
      <button disabled={pending} className="min-h-11 rounded-lg bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "Сохраняем…" : "Сохранить и уведомить дилера"}</button>
    </form>
  );
}

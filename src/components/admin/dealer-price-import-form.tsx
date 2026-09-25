"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { previewDealerPriceUpload, confirmDealerPriceUpload, type DealerPriceUploadState, type DealerPriceApplyState } from "@/app/admin/dealer-prices/actions";
import { MAX_DEALER_WORKBOOK_SOURCE_BYTES } from "@/lib/dealer-workbook-compact";
import type { DealerPriceChange, DealerPriceImportView } from "@/lib/dealer-price-import";

const money = (value: number | null) => value === null ? "—" : `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const labels = { changed: "Изменение", added: "Новая цена", removed: "Будет скрыт", unchanged: "Без изменений" };

function PriceRows({ rows }: { rows: DealerPriceChange[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
    <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="p-3">Товар и источник</th><th className="p-3">Сейчас</th><th className="p-3">После загрузки</th><th className="p-3">Изменение</th></tr></thead>
    <tbody>{rows.map((item) => <tr key={item.slug} className="border-b border-border/60 align-top">
      <td className="p-3"><p className="font-semibold">{item.title}</p>{item.source && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">{item.source.sheet}, строка {item.source.row}{item.source.multiplier > 1 ? ` · ${item.source.multiplier} шт. в комплекте` : ""}</summary><p className="mt-2 max-w-lg whitespace-pre-line">{item.source.model} · {money(item.source.price)} за единицу прайса{item.source.multiplier > 1 ? ` × ${item.source.multiplier}` : ""}<br />{item.source.description}</p></details>}</td>
      <td className="whitespace-nowrap p-3">{money(item.previous)}</td><td className="whitespace-nowrap p-3 font-semibold">{money(item.next)}</td><td className={`p-3 text-xs ${item.kind === "removed" ? "text-red-700" : "text-muted-foreground"}`}>{labels[item.kind]}</td>
    </tr>)}</tbody>
  </table></div>;
}

function Review({ preview }: { preview: DealerPriceImportView }) {
  const [state, action, pending] = useActionState<DealerPriceApplyState, FormData>(confirmDealerPriceUpload, {});
  const changed = preview.changes.filter((row) => row.kind !== "unchanged");
  const unchanged = preview.changes.filter((row) => row.kind === "unchanged");
  const count = (kind: DealerPriceChange["kind"]) => preview.changes.filter((row) => row.kind === kind).length;
  if (state.count !== undefined) return <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><p className="font-bold">Прайс обновлён: {state.count} позиций.</p><p className="mt-2">Новые цены уже доступны дилерам. Состав ранее отправленных заявок сохранён.</p></div>;
  return <section className="mt-7 rounded-xl border border-border bg-surface p-4 sm:p-6">
    <h2 className="font-display text-xl font-extrabold uppercase">Проверьте изменения</h2>
    <p className="mt-2 break-words text-sm text-muted-foreground">{preview.fileName} · предпросмотр действует 30 минут</p>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{(["changed", "added", "removed", "unchanged"] as const).map((kind) => <div key={kind} className="rounded-lg bg-black/[.035] p-3"><p className="text-2xl font-bold">{count(kind)}</p><p className="mt-1 text-xs text-muted-foreground">{labels[kind]}</p></div>)}</div>
    {!!preview.conflicts.length && <div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800"><p className="font-bold">Сначала исправьте ошибки в Excel и загрузите его снова</p><ul className="mt-2 list-disc space-y-2 pl-5">{preview.conflicts.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
    <p className="my-5 text-sm text-muted-foreground">Отрезки кабеля исключены: {preview.ignoredCuts}. Если позиция исчезла из нового прайса или не сопоставлена, её старая цена будет удалена и товар перестанет отображаться в дилерском заказе.</p>
    {changed.length ? <PriceRows rows={changed} /> : <p className="rounded-lg bg-black/[.03] p-4 text-sm">Цены сопоставленных товаров не изменились.</p>}
    {!!unchanged.length && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Без изменений: {unchanged.length}</summary><PriceRows rows={unchanged} /></details>}
    {!!preview.unmatched.length && <details className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"><summary className="cursor-pointer text-sm font-semibold text-amber-900">Не сопоставлено строк: {preview.unmatched.length} — не будут добавлены</summary><p className="mt-2 text-sm text-amber-900">Проверьте модель, описание и комплектацию. Для новых товаров нужно сначала настроить точное соответствие с каталогом; похожие названия автоматически не объединяются.</p><ul className="mt-3 space-y-3 text-xs text-amber-950">{preview.unmatched.map((row, index) => <li key={`${row.sheet}:${row.row}:${index}`}><p className="font-semibold">{row.model} · {money(row.sourcePrice)}</p><p>{row.sheet}, строка {row.row}</p><p className="mt-1 max-w-3xl whitespace-pre-line">{row.description}</p></li>)}</ul></details>}
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Для формул используются результаты, сохранённые в Excel. Перед загрузкой пересчитайте и сохраните книгу. Изменения названия, листа или описания требуют повторной проверки соответствия товара.</p>
    <form action={action} className="mt-6 border-t border-border pt-5">
      <input type="hidden" name="previewId" value={preview.id} />
      <label className="flex max-w-3xl items-start gap-3 text-sm leading-6"><input className="mt-1 size-4 accent-red-600" type="checkbox" name="confirmed" value="yes" required disabled={pending || !!preview.conflicts.length} /><span>Проверил цены, комплектацию и список скрываемых товаров. Заменить текущий дилерский прайс этим файлом.</span></label>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending || !!preview.conflicts.length} className="mt-4 rounded-lg bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "Применяем прайс…" : "Применить проверенный прайс"}</button>
    </form>
  </section>;
}

export function DealerPriceImportForm() {
  const [state, action, pending] = useActionState<DealerPriceUploadState, FormData>(previewDealerPriceUpload, {});
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const file = new FormData(event.currentTarget).get("source");
    if (!(file instanceof File) || !/\.xlsx$/i.test(file.name)) { setError("Выберите файл Excel в формате .xlsx."); return; }
    if (file.size > MAX_DEALER_WORKBOOK_SOURCE_BYTES) { setError("Размер исходного Excel должен быть не больше 150 МБ."); return; }
    setPreparing(true);
    try {
      const { compactDealerWorkbook } = await import("@/lib/dealer-workbook-compact");
      const compact = compactDealerWorkbook(new Uint8Array(await file.arrayBuffer()));
      const form = new FormData();
      form.set("workbook", new File([new Uint8Array(compact)], file.name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      startTransition(() => action(form));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось прочитать Excel. Сохраните его в формате .xlsx и попробуйте снова."); }
    finally { setPreparing(false); }
  }
  const busy = pending || preparing;
  return <>
    <form onSubmit={submit} className="mt-6 rounded-xl border border-border bg-surface p-5">
      <label htmlFor="dealer-price-file" className="block text-sm font-bold">Новый дилерский прайс (.xlsx)</label>
      <input id="dealer-price-file" name="source" type="file" accept=".xlsx" required disabled={busy} className="mt-3 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-black/5 file:px-4 file:py-2 file:font-semibold" />
      <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">До 150 МБ. Встроенные фото пропускаются при загрузке, исходный файл сохраняется без изменений. Используются столбцы «Модель», «Дил. цена» и «Описание».</p>
      <button type="submit" disabled={busy} className="mt-4 rounded-lg bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{preparing ? "Подготавливаем таблицы…" : pending ? "Сверяем с каталогом…" : "Загрузить и проверить"}</button>
      {(error || state.error) && <p role="alert" className="mt-3 text-sm text-red-700">{error || state.error}</p>}
    </form>
    {!busy && state.preview && <Review key={state.preview.id} preview={state.preview} />}
  </>;
}

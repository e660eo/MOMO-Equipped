"use client";
import { useMemo, useState } from "react";
import { parseBulkOrder, type BulkProduct } from "@/lib/dealer-bulk-order";
import { formatPrice } from "@/lib/format";

export function DealerBulkOrder({ products, quantities, onAdd, disabled }: { products: BulkProduct[]; quantities: Record<string, number>; onAdd: (lines: Array<{ slug: string; qty: number }>) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(false);
  const [added, setAdded] = useState(false);
  const rows = useMemo(() => parseBulkOrder(text, products, quantities), [text, products, quantities]);
  const errors = rows.some((row) => row.error);
  return <details className="mb-5 rounded-xl border border-black/10 bg-[#f7f7f7] p-4">
    <summary className="min-h-11 cursor-pointer text-sm font-bold">Быстрый заказ из Excel</summary>
    <p className="mt-2 text-sm text-black/60">Скопируйте две колонки: модель или артикул и количество. Например: UB-10.250 — 2. Цены берём из вашего дилерского прайса.</p>
    <label className="mt-3 block text-sm font-semibold">Список товаров<textarea value={text} onChange={(event) => { setText(event.target.value); setPreview(false); setAdded(false); }} maxLength={30000} rows={5} className="mt-2 block w-full rounded-lg border border-black/15 bg-white p-3 font-mono text-sm" placeholder={'UB-10.250\t2\nHE-612\t4'} /></label>
    <button type="button" disabled={!text.trim() || disabled} onClick={() => setPreview(true)} className="mt-3 min-h-11 rounded-lg border border-black/20 px-4 text-sm font-bold disabled:opacity-40">Проверить список</button>
    {preview && <div className="mt-4 space-y-2" aria-live="polite">
      {rows.map((row) => <div key={row.line} className={`rounded-lg border p-3 text-sm ${row.error ? "border-red-300 bg-red-50" : "border-black/10 bg-white"}`}><p className="break-words font-semibold">Строка {row.line}: {row.product?.title ?? row.query} × {row.qty || "?"}</p>{row.error ? <p className="mt-1 text-red-800">{row.error}</p> : <p className="mt-1 text-black/60">{formatPrice(row.product!.price)} за шт. · {formatPrice(row.product!.price * row.qty)}</p>}</div>)}
      {errors && <p role="alert" className="text-sm text-red-800">Исправьте отмеченные строки в списке и проверьте его снова.</p>}
      {!errors && rows.length > 0 && <p className="text-sm font-bold">Добавится на {formatPrice(rows.reduce((sum, row) => sum + row.product!.price * row.qty, 0))}</p>}
      <button type="button" disabled={errors || !rows.length || disabled} onClick={() => {
        if (errors || !rows.length || disabled) return;
        const totals = new Map<string, number>();
        for (const row of rows) totals.set(row.product!.slug, (totals.get(row.product!.slug) ?? 0) + row.qty);
        onAdd([...totals].map(([slug, qty]) => ({ slug, qty })));
        setText(""); setPreview(false); setAdded(true);
      }} className="min-h-11 rounded-lg bg-black px-4 text-sm font-bold text-white disabled:opacity-40">Добавить в черновик</button>
      <p className="text-xs text-black/55">Количество прибавится к уже выбранному. Заказ отправляется отдельно после проверки черновика.</p>
    </div>}
    {added && <p role="status" className="mt-3 text-sm font-semibold">Товары добавлены в черновик.</p>}
  </details>;
}

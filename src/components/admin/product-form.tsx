"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { productImageUrl } from "@/lib/format";
import type { Product, Category, Brand } from "@/lib/types";
import { saveProduct, type ActionState } from "@/app/admin/products/actions";

/*
  Форма товара.

  Фото хранятся в состоянии: порядок задаёт обложку (первый снимок), поэтому
  «сделать обложкой» — это перемещение в начало списка. Итоговый порядок
  уезжает скрытым полем, новые файлы — обычным input[type=file] в той же
  отправке, чтобы не заводить отдельный экран загрузки.
*/

const field =
  "w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none";
const label = "block text-[0.78rem] font-medium";

export function ProductForm({
  product,
  categories,
  brands,
}: {
  product?: Product;
  categories: Category[];
  brands: Brand[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveProduct,
    {},
  );
  const [photos, setPhotos] = useState<string[]>(
    product ? [product.image, ...(product.images ?? [])] : [],
  );

  const stock = product?.inStock === true ? "yes" : product?.inStock === false ? "no" : "";

  return (
    <form action={formAction} className="max-w-[760px]">
      {product && <input type="hidden" name="slug" value={product.slug} />}
      <input type="hidden" name="photos" value={photos.join(",")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="title">
            Название
          </label>
          <input
            id="title"
            name="title"
            defaultValue={product?.title}
            required
            className={`${field} mt-1.5`}
            placeholder="Сабвуфер автомобильный TS-12.800 12 дюймов"
          />
          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
            Из названия сайт сам достаёт характеристики: «12 дюймов», «800 Вт»,
            «4 Ом» — пишите их так же, как в прайсе.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="category">
            Категория
          </label>
          <select
            id="category"
            name="category"
            defaultValue={product?.category ?? ""}
            required
            className={`${field} mt-1.5`}
          >
            <option value="">Выберите…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="brand">
            Бренд
          </label>
          <select
            id="brand"
            name="brand"
            defaultValue={product?.brand ?? "MOMO"}
            required
            className={`${field} mt-1.5`}
          >
            {brands.map((b) => (
              <option key={b.slug} value={b.title}>
                {b.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="price">
            Цена, ₽
          </label>
          <input
            id="price"
            name="price"
            inputMode="numeric"
            defaultValue={product?.price}
            required
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <label className={label} htmlFor="inStock">
            Наличие
          </label>
          <select
            id="inStock"
            name="inStock"
            defaultValue={stock}
            className={`${field} mt-1.5`}
          >
            <option value="">Не указывать</option>
            <option value="yes">В наличии</option>
            <option value="no">Под заказ</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="description">
            Характеристики и описание
          </label>
          <textarea
            id="description"
            name="description"
            rows={7}
            defaultValue={product?.description?.join("\n")}
            className={`${field} mt-1.5 font-mono text-[0.82rem]`}
            placeholder={"Диаметр - 300mm\nМощность MAX - 800 W\nИмпеданс - 4 Ом"}
          />
          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
            По строке на характеристику. Строки вида «Название - значение»
            встанут в таблицу характеристик, остальные — в примечания.
          </p>
        </div>
      </div>

      {/* Фото */}
      <fieldset className="mt-8">
        <legend className="text-[0.78rem] font-medium">Фото</legend>
        <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
          Первое фото — обложка в каталоге. Снимки обрезаются по краям и
          сжимаются автоматически.
        </p>

        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((photo, i) => (
              <div
                key={photo}
                className="w-[132px] rounded-sm border border-border bg-surface p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImageUrl(photo)}
                  alt=""
                  className="h-[104px] w-full rounded-sm bg-tile object-contain"
                />
                <div className="mt-2 flex items-center justify-between text-[0.7rem]">
                  {i === 0 ? (
                    <span className="font-semibold text-signal">Обложка</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((list) => [
                          photo,
                          ...list.filter((p) => p !== photo),
                        ])
                      }
                      className="text-muted-foreground transition-colors hover:text-signal"
                    >
                      На обложку
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((list) => list.filter((p) => p !== photo))
                    }
                    className="text-muted-foreground transition-colors hover:text-[var(--signal-text)]"
                  >
                    Убрать
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          name="newPhotos"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="mt-3 block w-full text-[0.82rem] file:mr-3 file:rounded-sm file:border-0 file:bg-signal file:px-4 file:py-2 file:text-[0.8rem] file:font-semibold file:text-white"
        />
      </fieldset>

      {/* Флаги */}
      <div className="mt-7 space-y-2.5 text-[0.85rem]">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="isClearance"
            defaultChecked={product?.isClearance}
            className="h-4 w-4 accent-[var(--color-signal)]"
          />
          Уценённый товар — попадёт на страницу распродажи
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="hidden"
            defaultChecked={product?.hidden}
            className="h-4 w-4 accent-[var(--color-signal)]"
          />
          Скрыть с витрины (останется здесь, в панели)
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="confirmPriceDrop"
            className="h-4 w-4 accent-[var(--color-signal)]"
          />
          Цена указана верно (нужно, если снижаете больше чем вдвое)
        </label>
      </div>

      {state.error && (
        <p className="mt-6 rounded-sm border border-[var(--signal-text)] px-4 py-3 text-[0.85rem] text-[var(--signal-text)]">
          {state.error}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <Link
          href="/admin/products"
          className="text-[0.85rem] text-muted-foreground transition-colors hover:text-signal"
        >
          Отмена
        </Link>
        {product && (
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="ml-auto text-[0.85rem] text-muted-foreground transition-colors hover:text-signal"
          >
            Открыть карточку на сайте ↗
          </Link>
        )}
      </div>
    </form>
  );
}

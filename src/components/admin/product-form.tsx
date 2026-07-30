"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { productImageUrl } from "@/lib/format";
import type { Product, Category, Brand } from "@/lib/types";
import {
  saveProduct,
  addPhoto,
  replacePhoto,
  removePhoto,
  setCover,
  type ActionState,
  type PhotoResult,
} from "@/app/admin/products/actions";
import { PhotoEditor } from "./photo-editor";

/*
  Форма товара.

  Фото хранятся в состоянии: порядок задаёт обложку (первый снимок), поэтому
  «сделать обложкой» — это перемещение в начало списка. Итоговый порядок
  уезжает скрытым полем.

  Новые файлы держим в состоянии (с превью-URL), а не читаем прямо из input:
  так их можно редактировать (поворот/обрезка/фон, см. PhotoEditor) и заменять.
  Перед отправкой состояние синхронизируется в скрытый input[type=file] через
  DataTransfer — серверный экшен читает файлы оттуда как обычно.

  Правка уже загруженного снимка = заменяем его отредактированной загрузкой:
  имя убираем из photos, готовый File кладём в новые. Старый файл на сервере
  осиротеет — его подчистит удаление товара, как и общие снимки.
*/

type NewItem = { file: File; url: string };
type Editing =
  | { kind: "existing"; name: string }
  | { kind: "new"; index: number };

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
  const editingProduct = Boolean(product);
  const slug = product?.slug;

  const [photos, setPhotos] = useState<string[]>(
    product ? [product.image, ...(product.images ?? [])] : [],
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Новые файлы (с превью) — только для НОВОГО товара: у него ещё нет карточки,
  // поэтому снимки уезжают вместе с первым «Сохранить» (скрытый input ниже).
  // У существующего товара фото сохраняются сразу, newItems остаётся пустым.
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = hiddenRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    newItems.forEach((it) => dt.items.add(it.file));
    input.files = dt.files;
  }, [newItems]);

  useEffect(() => {
    return () => newItems.forEach((it) => URL.revokeObjectURL(it.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Операция над фото существующего товара: сразу на сервер, список — из ответа.
  async function runPhotoOp(op: Promise<PhotoResult>) {
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      const r = await op;
      if (r.error) setPhotoErr(r.error);
      else if (r.photos) setPhotos(r.photos);
    } catch {
      setPhotoErr("Не удалось — попробуйте ещё раз.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // позволяем выбрать тот же файл снова
    if (!files.length) return;
    if (!editingProduct) {
      setNewItems((list) => [
        ...list,
        ...files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
      ]);
      return;
    }
    // Существующий товар — грузим по одному сразу: каждый файл своим запросом,
    // это щадит память сервера и не роняет всё, если один снимок не обработался.
    void (async () => {
      for (const f of files) {
        const fd = new FormData();
        fd.append("photo", f);
        await runPhotoOp(addPhoto(slug!, fd));
      }
    })();
  }

  function onCover(name: string) {
    if (editingProduct) void runPhotoOp(setCover(slug!, name));
    else setPhotos((l) => [name, ...l.filter((p) => p !== name)]);
  }

  function onRemove(name: string) {
    if (editingProduct) void runPhotoOp(removePhoto(slug!, name));
    else setPhotos((l) => l.filter((p) => p !== name));
  }

  function removeNew(index: number) {
    setNewItems((list) => {
      const it = list[index];
      if (it) URL.revokeObjectURL(it.url);
      return list.filter((_, i) => i !== index);
    });
  }

  function applyEdit(file: File) {
    if (!editing) return;
    // Существующий товар: правка уже загруженного = замена сразу на сервере.
    if (editingProduct && editing.kind === "existing") {
      const fd = new FormData();
      fd.append("photo", file);
      void runPhotoOp(replacePhoto(slug!, editing.name, fd));
      setEditing(null);
      return;
    }
    // Новый товар: правка идёт в состоянии до первого сохранения.
    const item = { file, url: URL.createObjectURL(file) };
    if (editing.kind === "new") {
      setNewItems((list) => {
        const old = list[editing.index];
        if (old) URL.revokeObjectURL(old.url);
        return list.map((it, i) => (i === editing.index ? item : it));
      });
    } else {
      setPhotos((list) => list.filter((p) => p !== editing.name));
      setNewItems((list) => [...list, item]);
    }
    setEditing(null);
  }

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
          <label className={label} htmlFor="stock">
            Остаток, шт
          </label>
          <input
            id="stock"
            name="stock"
            inputMode="numeric"
            defaultValue={
              typeof product?.stock === "number" ? product.stock : ""
            }
            placeholder="не веду учёт"
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
            Ноль — товар нельзя купить, на сайте будет «под заказ». Пусто —
            учёта нет, тогда наличие берётся из поля ниже.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="inStock">
            Наличие без учёта остатка
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
          Можно добавить сразу несколько фото — в окне выбора отметьте нужные
          с зажатым Ctrl. Первое — обложка в каталоге, «На обложку» её меняет.
          «Ред.» — повернуть, обрезать и убрать фон (сделать белым). У
          сохранённого товара любое изменение фото применяется сразу, не выходя
          со страницы. Снимки обрезаются по краям и сжимаются автоматически.
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
                <div className="mt-2 flex items-center gap-2 text-[0.7rem]">
                  {i === 0 ? (
                    <span className="font-semibold text-signal">Обложка</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCover(photo)}
                      disabled={photoBusy}
                      className="text-muted-foreground transition-colors hover:text-signal disabled:opacity-50"
                    >
                      На обложку
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: "existing", name: photo })}
                    disabled={photoBusy}
                    className="text-muted-foreground transition-colors hover:text-signal disabled:opacity-50"
                  >
                    Ред.
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(photo)}
                    disabled={photoBusy}
                    className="ml-auto text-muted-foreground transition-colors hover:text-[var(--signal-text)] disabled:opacity-50"
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
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          disabled={photoBusy}
          className="mt-3 block w-full text-[0.82rem] file:mr-3 file:rounded-sm file:border-0 file:bg-signal file:px-4 file:py-2 file:text-[0.8rem] file:font-semibold file:text-white disabled:opacity-60"
        />
        {/* Для нового товара файлы уезжают этим скрытым input при «Сохранить». */}
        <input
          ref={hiddenRef}
          type="file"
          name="newPhotos"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden
        />

        {editingProduct && (
          <p className="mt-2 text-[0.75rem] text-muted-foreground">
            {photoBusy
              ? "Загружаю…"
              : "Изменения фото сохраняются сразу — форму пересохранять не нужно."}
          </p>
        )}
        {photoErr && (
          <p className="mt-2 text-[0.8rem] text-[var(--signal-text)]">{photoErr}</p>
        )}

        {!editingProduct && newItems.length > 0 && (
          <div className="mt-3">
            <p className="text-[0.75rem] text-muted-foreground">
              Добавятся после «Сохранить» ({newItems.length}):
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {newItems.map((it, i) => (
                <div
                  key={it.url}
                  className="w-[132px] rounded-sm border border-dashed border-signal bg-surface p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt=""
                    className="h-[104px] w-full rounded-sm bg-tile object-contain"
                  />
                  <div className="mt-2 flex items-center gap-2 text-[0.7rem]">
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "new", index: i })}
                      className="font-semibold text-signal transition-colors hover:text-[#ff6a1f]"
                    >
                      Ред.
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNew(i)}
                      className="ml-auto text-muted-foreground transition-colors hover:text-[var(--signal-text)]"
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {editing &&
        (editing.kind === "existing" || newItems[editing.index]) && (
          <PhotoEditor
            src={
              editing.kind === "existing"
                ? productImageUrl(editing.name)
                : newItems[editing.index].file
            }
            fileName={
              editing.kind === "existing"
                ? editing.name
                : newItems[editing.index].file.name
            }
            onApply={applyEdit}
            onCancel={() => setEditing(null)}
          />
        )}

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
          className="rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_20px_-6px_rgba(255,85,0,0.6)] active:scale-95 disabled:opacity-60"
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

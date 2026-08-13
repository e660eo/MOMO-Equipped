"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { productAudioUrl, productImageUrl } from "@/lib/format";
import type { Product, Category, Brand } from "@/lib/types";
import {
  saveProduct,
  addPhoto,
  replacePhoto,
  removePhoto,
  setCover,
  restoreProductPhotos,
  type ActionState,
  type PhotoResult,
} from "@/app/admin/products/actions";
import { PhotoEditor } from "./photo-editor";
import { templateForCategory } from "@/lib/spec-templates";

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
type UploadPreview = NewItem & {
  id: string;
  status: "waiting" | "uploading" | "error";
  error?: string;
};
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
  const [photoUndo, setPhotoUndo] = useState<string[] | null>(null);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreview[]>([]);
  const [title, setTitle] = useState(product?.title ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [description, setDescription] = useState(product?.description?.join("\n") ?? "");

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
    const previous = [...photos];
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      const r = await op;
      if (r.error) setPhotoErr(r.error);
      else if (r.photos) {
        setPhotos(r.photos);
        setPhotoUndo(previous);
        setPhotoSaved(true);
        setPhotoNotice("Изменение фотографии сохранено.");
      }
    } catch {
      setPhotoErr("Не удалось — попробуйте ещё раз.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function undoPhotoChange() {
    if (!slug || !photoUndo) return;
    const previous = [...photoUndo];
    setPhotoBusy(true);
    const result = await restoreProductPhotos(slug, previous);
    setPhotoBusy(false);
    if (result.error) setPhotoErr(result.error);
    else {
      setPhotos(result.photos ?? previous);
      setPhotoUndo(null);
      setPhotoSaved(false);
      setPhotoNotice("Последнее изменение фотографии отменено.");
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // позволяем выбрать тот же файл снова
    if (!files.length) return;
    if (!editingProduct) {
      setPhotoErr(null);
      setNewItems((list) => [
        ...list,
        ...files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
      ]);
      return;
    }
    const selected = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      url: URL.createObjectURL(file),
      status: "waiting" as const,
    }));
    setUploadPreviews((current) => [...current, ...selected]);
    void uploadExistingPhotos(selected);
  }

  // Локальное превью появляется сразу. Зелёное подтверждение показываем только
  // после ответа сервера, когда файл уже записан и привязан к товару.
  async function uploadExistingPhotos(items: UploadPreview[]) {
    if (!slug || items.length === 0) return;
    const previous = [...photos];
    const uploaded: string[] = [];
    const failed: string[] = [];
    setPhotoBusy(true);
    setPhotoErr(null);
    setPhotoNotice(null);
    setPhotoSaved(false);

    for (const item of items) {
      setUploadPreviews((current) =>
        current.map((preview) =>
          preview.id === item.id
            ? { ...preview, status: "uploading", error: undefined }
            : preview,
        ),
      );
      try {
        const formData = new FormData();
        formData.append("photo", item.file);
        const result = await addPhoto(slug, formData);
        if (result.error || !result.photos) {
          const error = result.error ?? "Сервер не подтвердил сохранение файла.";
          failed.push(item.file.name);
          setUploadPreviews((current) =>
            current.map((preview) =>
              preview.id === item.id
                ? { ...preview, status: "error", error }
                : preview,
            ),
          );
          continue;
        }
        setPhotos(result.photos);
        uploaded.push(item.file.name);
        URL.revokeObjectURL(item.url);
        setUploadPreviews((current) =>
          current.filter((preview) => preview.id !== item.id),
        );
      } catch {
        failed.push(item.file.name);
        setUploadPreviews((current) =>
          current.map((preview) =>
            preview.id === item.id
              ? {
                  ...preview,
                  status: "error",
                  error: "Соединение оборвалось. Повторите загрузку.",
                }
              : preview,
          ),
        );
      }
    }

    if (uploaded.length > 0) {
      setPhotoUndo(previous);
      setPhotoSaved(true);
      setPhotoNotice(
        uploaded.length === 1
          ? `Фото «${uploaded[0]}» загружено и сохранено.`
          : `Загружено и сохранено фотографий: ${uploaded.length}.`,
      );
    }
    if (failed.length > 0) {
      setPhotoErr(
        failed.length === 1
          ? `Не загрузилось фото «${failed[0]}». Причина указана на превью.`
          : `Не загрузились фотографии: ${failed.join(", ")}. Причины указаны на превью.`,
      );
    }
    setPhotoBusy(false);
  }

  function retryUpload(id: string) {
    const item = uploadPreviews.find((preview) => preview.id === id);
    if (!item || photoBusy) return;
    void uploadExistingPhotos([{ ...item, status: "waiting", error: undefined }]);
  }

  function dismissUpload(id: string) {
    setUploadPreviews((current) => {
      const item = current.find((preview) => preview.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((preview) => preview.id !== id);
    });
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

  const initialAvailability = product?.inStock === true ? "yes" : product?.inStock === false ? "no" : "";
  const previewImage = photos[0] ? productImageUrl(photos[0]) : newItems[0]?.url;

  function applySpecTemplate() {
    const existing = new Set(description.split("\n").map((line) => line.split(/\s[-—:]\s/)[0].trim().toLowerCase()));
    const additions = templateForCategory(category).filter((name) => !existing.has(name.toLowerCase())).map((name) => `${name} - `);
    setDescription([description.trim(), ...additions].filter(Boolean).join("\n"));
  }

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
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
            value={category}
            onChange={(event) => setCategory(event.target.value)}
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
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ""))}
            required
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <label className={label} htmlFor="ozonSku">
            SKU Ozon
          </label>
          <input
            id="ozonSku"
            name="ozonSku"
            inputMode="numeric"
            defaultValue={product?.ozonSku ?? ""}
            placeholder="Например, 254803288"
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
            Нужен для автоматической Ozon Доставки. Пустое поле отключает её
            для этого товара.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="ozonOfferId">
            Артикул Ozon
          </label>
          <input
            id="ozonOfferId"
            name="ozonOfferId"
            defaultValue={product?.ozonOfferId ?? ""}
            placeholder="Например, BD-5000.1"
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
            defaultValue={initialAvailability}
            required
            className={`${field} mt-1.5`}
          >
            <option value="">Выберите обязательно…</option>
            <option value="yes">В наличии</option>
            <option value="no">Под заказ</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><label className={label} htmlFor="description">Характеристики и описание</label><button type="button" onClick={applySpecTemplate} disabled={!category} className="rounded-sm border border-border px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground hover:border-signal hover:text-signal disabled:opacity-40">Подставить шаблон категории</button></div>
          <textarea
            id="description"
            name="description"
            rows={7}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${field} mt-1.5 font-mono text-[0.82rem]`}
            placeholder={"Диаметр - 300mm\nМощность MAX - 800 W\nИмпеданс - 4 Ом"}
          />
          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
            По строке на характеристику. Строки вида «Название - значение»
            встанут в таблицу характеристик, остальные — в примечания.
          </p>
        </div>
      </div>

      <details className="mt-6 rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-[0.85rem] font-semibold">Предпросмотр карточки и SEO</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="flex h-36 items-center justify-center rounded-sm bg-tile">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewImage} alt="" className="max-h-full max-w-full object-contain" />
            ) : <span className="text-[0.75rem] text-muted-foreground">Добавьте фото</span>}
          </div>
          <div><p className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">Карточка товара</p><p className="mt-1 font-display text-lg font-extrabold">{title || "Название товара"}</p><p className="mt-2 text-signal">{price ? `${Number(price).toLocaleString("ru-RU")} ₽` : "Цена не указана"}</p><p className="mt-4 text-[0.72rem] uppercase tracking-wider text-muted-foreground">Сниппет поиска</p><p className="mt-1 text-[#1a0dab]">{title ? `${title} — купить в MOMO Equipped` : "Название товара — купить в MOMO Equipped"}</p><p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">{description.split("\n").filter(Boolean).slice(0, 2).join(". ") || "Добавьте ключевые характеристики — они появятся в описании страницы."}</p></div>
        </div>
      </details>

      <fieldset className="mt-8 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <legend className="px-2 text-[0.78rem] font-semibold">Онлайн-стенд</legend>
        <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
          Запись должна быть сделана тем же микрофоном, с того же расстояния и на
          одинаковых настройках. Пока запись не опубликована, покупатели увидят
          только отметку «Запись готовится».
        </p>

        {product?.listening?.audio && (
          <div className="mt-4 rounded-sm border border-border bg-bg p-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Текущая запись
            </p>
            <audio
              controls
              preload="metadata"
              src={productAudioUrl(product.listening.audio)}
              className="mt-2 w-full"
            />
            <label className="mt-3 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
              <input
                type="checkbox"
                name="removeListeningAudio"
                className="h-4 w-4 accent-[var(--color-signal)]"
              />
              Удалить текущую запись при сохранении
            </label>
          </div>
        )}

        <div className="mt-4">
          <label className={label} htmlFor="listeningAudio">
            {product?.listening?.audio ? "Заменить запись" : "Загрузить запись"}
          </label>
          <input
            id="listeningAudio"
            name="listeningAudio"
            type="file"
            accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.wav,.ogg,.m4a"
            className="mt-2 block w-full text-[0.82rem] file:mr-3 file:rounded-sm file:border-0 file:bg-fg file:px-4 file:py-2 file:text-[0.8rem] file:font-semibold file:text-bg"
          />
          <p className="mt-1.5 text-[0.72rem] text-muted-foreground">
            MP3, WAV, OGG или M4A, не больше 30 МБ. Для сайта предпочтительнее MP3.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["listeningHighs", "Верха", product?.listening?.highs],
            ["listeningMids", "Середина", product?.listening?.mids],
            ["listeningLows", "Низы", product?.listening?.lows],
            ["listeningVolume", "Громкость", product?.listening?.volume],
          ].map(([name, text, value]) => (
            <label key={String(name)} className="text-[0.75rem] font-medium">
              {text}
              <input
                name={String(name)}
                inputMode="decimal"
                defaultValue={value ?? ""}
                placeholder="0–10"
                className={`${field} mt-1.5`}
              />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="listeningNote">Комментарий эксперта</label>
          <textarea
            id="listeningNote"
            name="listeningNote"
            rows={3}
            maxLength={240}
            defaultValue={product?.listening?.note ?? ""}
            placeholder="Например: яркая подача вокала, лучше раскрывается от 100 Вт RMS."
            className={`${field} mt-1.5`}
          />
        </div>

        <label className="mt-4 flex items-start gap-2.5 text-[0.82rem]">
          <input
            type="checkbox"
            name="listeningPublished"
            defaultChecked={product?.listening?.published}
            className="mt-0.5 h-4 w-4 accent-[var(--color-signal)]"
          />
          <span>
            <b className="font-semibold">Показывать запись покупателям</b>
            <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">
              Включайте только после проверки записи в наушниках.
            </span>
          </span>
        </label>
      </fieldset>

      {/* Фото */}
      <fieldset className="mt-8">
        <legend className="text-[0.78rem] font-medium">Фото</legend>
        <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
          Можно добавить сразу несколько фото — в окне выбора отметьте нужные
          с зажатым Ctrl. Первое — обложка в каталоге, «На обложку» её меняет.
          «Ред.» — повернуть, обрезать и убрать фон (сделать белым). У
           сохранённого товара изменение фото применяется сразу и записывается в
           журнал. Последнее действие можно отменить ниже. Снимки сжимаются автоматически.
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

        {editingProduct && uploadPreviews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3" aria-live="polite">
            {uploadPreviews.map((item) => (
              <div
                key={item.id}
                className={`w-[156px] rounded-sm border bg-surface p-2 ${
                  item.status === "error"
                    ? "border-signal"
                    : "border-amber-500/60"
                }`}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={`Выбрано фото ${item.file.name}`}
                    className="h-[104px] w-full rounded-sm bg-tile object-contain"
                  />
                  <span
                    className={`absolute inset-x-1 bottom-1 rounded-sm px-2 py-1 text-center text-[0.68rem] font-semibold text-white ${
                      item.status === "error" ? "bg-signal" : "bg-black/75"
                    }`}
                  >
                    {item.status === "waiting"
                      ? "Ожидает"
                      : item.status === "uploading"
                        ? "Загружается…"
                        : "Не загружено"}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[0.68rem]" title={item.file.name}>
                  {item.file.name}
                </p>
                {item.error && (
                  <p className="mt-1 text-[0.67rem] leading-snug text-[var(--signal-text)]">
                    {item.error}
                  </p>
                )}
                {item.status === "error" && (
                  <div className="mt-2 flex items-center gap-2 text-[0.68rem] font-semibold">
                    <button
                      type="button"
                      onClick={() => retryUpload(item.id)}
                      disabled={photoBusy}
                      className="text-signal hover:underline disabled:opacity-50"
                    >
                      Повторить
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissUpload(item.id)}
                      disabled={photoBusy}
                      className="text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Убрать
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.75rem] text-muted-foreground">
            <span>{photoBusy ? "Фотография загружается и обрабатывается…" : "Изменения фото сохраняются сразу и отражаются в журнале."}</span>
            {photoUndo && !photoBusy && <button type="button" onClick={undoPhotoChange} className="font-semibold text-signal hover:underline">Отменить последнее изменение фото</button>}
          </div>
        )}
        {photoNotice && !photoBusy && (
          <p
            className={`mt-2 rounded-sm border px-3 py-2 text-[0.8rem] font-medium ${
              photoSaved
                ? "border-green-600/30 bg-green-600/5 text-green-700"
                : "border-border bg-tile text-foreground"
            }`}
            role="status"
          >
            {photoSaved ? "✓ " : ""}{photoNotice}
          </p>
        )}
        {photoErr && (
          <p className="mt-2 text-[0.8rem] text-[var(--signal-text)]">{photoErr}</p>
        )}

        {!editingProduct && newItems.length > 0 && (
          <div className="mt-3">
            <p className="rounded-sm border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[0.75rem] text-foreground" role="status">
              Выбрано фотографий: {newItems.length}. Превью видно ниже; файлы загрузятся после нажатия «Сохранить товар».
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
            name="isNew"
            defaultChecked={product?.isNew}
            className="h-4 w-4 accent-[var(--color-signal)]"
          />
          Новинка — попадёт в раздел новых поступлений
        </label>
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

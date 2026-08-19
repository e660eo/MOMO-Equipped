"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Star, X } from "lucide-react";
import {
  getReviewEligibility,
  submitProductReview,
  type ReviewActionState,
  type ReviewEligibility,
} from "@/app/review-actions";
import { useAccount } from "@/lib/account-store";
import { useCustomer } from "@/components/customer-provider";

const RATINGS = [1, 2, 3, 4, 5] as const;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ReviewForm({
  productSlug,
  productTitle,
}: {
  productSlug: string;
  productTitle: string;
}) {
  const router = useRouter();
  const customer = useCustomer();
  const openAccount = useAccount((state) => state.openModal);
  const formRef = useRef<HTMLFormElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<ReviewActionState, FormData>(
    submitProductReview,
    {},
  );
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState<(typeof RATINGS)[number]>(5);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    if (state.success) return;
    let active = true;
    setEligibility(null);
    void getReviewEligibility(productSlug).then((result) => {
      if (active) setEligibility(result);
    });
    return () => {
      active = false;
    };
  }, [customer?.id, productSlug, state.success]);

  useEffect(() => {
    if (!state.success) return;
    setEligibility({ status: "already_reviewed" });
    setText("");
    setRating(5);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setFileError("");
    if (photoRef.current) photoRef.current.value = "";
    formRef.current?.reset();
    router.refresh();
  }, [preview, router, state.success]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setFileError("");
    if (photoRef.current) photoRef.current.value = "";
  }

  function choosePhoto(file?: File) {
    clearPhoto();
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setFileError("Нужна фотография JPG, PNG или WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("Фотография больше 10 МБ — уменьшите размер файла.");
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-5" role="status">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-green-700" size={21} />
          <div>
            <p className="font-semibold">Отзыв опубликован</p>
            <p className="mt-1 text-sm text-muted-foreground">Спасибо — он уже появился в карточке товара.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!eligibility) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground" aria-live="polite">
        Проверяем оплаченный заказ…
      </div>
    );
  }

  if (eligibility.status === "login_required") {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <p className="font-semibold">Покупали этот товар?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Войдите в аккаунт — после подтверждённой оплаты здесь откроется форма отзыва.</p>
        </div>
        <button type="button" onClick={() => openAccount("profile")} className="mt-4 min-h-11 rounded-sm bg-signal px-5 text-sm font-semibold text-white sm:mt-0">
          Войти
        </button>
      </div>
    );
  }

  if (eligibility.status === "not_purchased") {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="font-semibold">Отзыв доступен после оплаты</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">В истории этого аккаунта пока нет оплаченного заказа с товаром «{productTitle}».</p>
      </div>
    );
  }

  if (eligibility.status === "already_reviewed") {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        Вы уже оставили отзыв на этот товар. Один покупатель может опубликовать один отзыв.
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} encType="multipart/form-data" className="rounded-2xl border border-signal/30 bg-surface p-5 sm:p-6">
      <input type="hidden" name="productSlug" value={productSlug} />
      <h3 className="font-display text-base font-bold uppercase">Ваш отзыв</h3>
      <p className="mt-1 text-sm text-muted-foreground">Покупка подтверждена. Расскажите, как товар показал себя в работе.</p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Оценка</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Оценка товара">
          {RATINGS.map((value) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-1 rounded-sm border border-border px-3 transition-colors has-[:checked]:border-signal has-[:checked]:bg-signal/5">
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              <Star aria-hidden size={17} className={rating >= value ? "fill-signal text-signal" : "text-muted-foreground"} />
              <span className="text-sm font-semibold">{value}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block text-sm font-medium" htmlFor={`review-text-${productSlug}`}>
        Текст отзыва
        <textarea
          id={`review-text-${productSlug}`}
          name="text"
          required
          minLength={10}
          maxLength={1500}
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Что понравилось, как устанавливали и как звучит система?"
          className="mt-2 min-h-32 w-full rounded-sm border border-input bg-bg px-3.5 py-3 text-base outline-none transition-colors focus:border-signal focus-visible:ring-2 focus-visible:ring-signal/25"
        />
        <span className="mt-1.5 flex justify-between gap-4 text-[0.73rem] text-muted-foreground">
          <span>Минимум 10 символов</span>
          <span>{text.length}/1500</span>
        </span>
      </label>

      <div className="mt-5">
        <label className="block text-sm font-medium" htmlFor={`review-photo-${productSlug}`}>Фотография <span className="font-normal text-muted-foreground">(необязательно)</span></label>
        <input
          ref={photoRef}
          id={`review-photo-${productSlug}`}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={`review-photo-help-${productSlug}${fileError ? ` review-photo-error-${productSlug}` : ""}`}
          onChange={(event) => choosePhoto(event.target.files?.[0])}
          className="mt-2 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-sm file:border-0 file:bg-foreground file:px-4 file:font-semibold file:text-bg"
        />
        <p id={`review-photo-help-${productSlug}`} className="mt-1.5 text-[0.73rem] text-muted-foreground">JPG, PNG или WEBP до 10 МБ. Перед публикацией снимок автоматически сожмётся.</p>
        {fileError && <p id={`review-photo-error-${productSlug}`} role="alert" className="mt-1.5 text-sm text-[var(--signal-text)]">{fileError}</p>}
      </div>

      {preview && (
        <div className="relative mt-4 aspect-[4/3] max-w-[360px] overflow-hidden rounded-xl border border-border bg-bg">
          <Image src={preview} alt="Предпросмотр фотографии к отзыву" fill unoptimized className="object-cover" sizes="360px" />
          <button type="button" onClick={clearPhoto} aria-label="Убрать фотографию" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white">
            <X size={18} />
          </button>
        </div>
      )}

      {(state.error || fileError) && (
        <p role="alert" className="mt-5 rounded-sm border border-[var(--signal-text)] bg-signal/5 px-4 py-3 text-sm text-[var(--signal-text)]">
          {state.error || fileError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || Boolean(fileError) || text.trim().length < 10}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-signal px-6 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <ImagePlus aria-hidden size={17} />
        {pending ? "Публикуем…" : "Опубликовать отзыв"}
      </button>
    </form>
  );
}

import Image from "next/image";
import { BadgeCheck, MessageSquare, Star } from "lucide-react";
import { ReviewForm } from "@/components/review-form";
import type { PublicProductReview } from "@/lib/types";
import { plural } from "@/lib/utils";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Оценка ${rating} из 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} aria-hidden size={15} className={value <= rating ? "fill-signal text-signal" : "text-border"} />
      ))}
    </span>
  );
}

export function ProductReviews({
  productSlug,
  productTitle,
  reviews,
}: {
  productSlug: string;
  productTitle: string;
  reviews: PublicProductReview[];
}) {
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <section id="reviews" className="mt-20 scroll-mt-40">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">Отзывы</h2>
          <p className="mt-1 text-sm text-muted-foreground">Только от покупателей с подтверждённой оплатой.</p>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2">
            <span className="font-display text-lg font-extrabold">{average.toFixed(1)}</span>
            <Stars rating={Math.round(average)} />
            <span className="text-xs text-muted-foreground">{reviews.length} {plural(reviews.length, "отзыв", "отзыва", "отзывов")}</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <MessageSquare size={20} className="text-muted-foreground" />
          </span>
          <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
            Отзывов пока нет. После оплаты заказа покупатель сможет поделиться опытом и прикрепить фотографию установки.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {review.photo && (
                <div className="relative aspect-[4/3] bg-bg">
                  <Image src={`/media/${review.photo}`} alt={`Фотография к отзыву о товаре ${productTitle}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 580px" />
                </div>
              )}
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{review.author}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                      <BadgeCheck aria-hidden size={14} className="text-signal" /> Покупка подтверждена
                    </p>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-4 whitespace-pre-line text-[0.9rem] leading-relaxed text-foreground/90">{review.text}</p>
                <time dateTime={review.createdAt} className="mt-4 block text-[0.75rem] text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ReviewForm productSlug={productSlug} productTitle={productTitle} />
      </div>
    </section>
  );
}

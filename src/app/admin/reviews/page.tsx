import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MessageSquare, Star } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdminPage } from "@/lib/admin-auth";
import { getProductReviews } from "@/lib/product-reviews";
import { plural } from "@/lib/utils";
import { deleteReviewAction } from "./actions";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const reviews = getProductReviews();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">Покупатели</p>
          <h1 className="mt-1 font-display text-xl font-extrabold uppercase">Отзывы</h1>
          <p className="mt-1 max-w-[68ch] text-[0.85rem] leading-relaxed text-muted-foreground">
            Здесь только отзывы клиентов, у которых найден оплаченный заказ с соответствующим товаром.
          </p>
        </div>
        <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted-foreground">
          {reviews.length} {plural(reviews.length, "отзыв", "отзыва", "отзывов")}
        </span>
      </div>

      {params.deleted && (
        <p className="mt-5 rounded-sm border border-green-600/30 bg-green-600/5 px-4 py-3 text-sm text-green-700">
          Отзыв и прикреплённая фотография удалены.
        </p>
      )}

      {reviews.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground">
            <MessageSquare size={20} />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">Отзывы появятся здесь после публикации покупателями.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              {review.photo && (
                <div className="relative aspect-[16/9] bg-bg">
                  <Image src={`/media/${review.photo}`} alt="Фотография покупателя к отзыву" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 580px" />
                </div>
              )}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/product/${review.productSlug}#reviews`} target="_blank" className="font-display font-bold uppercase hover:text-signal">
                      {review.productTitle} ↗
                    </Link>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                      <BadgeCheck size={14} className="text-signal" /> {review.author} · подтверждённая покупка
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm font-semibold">
                    <Star size={14} className="fill-signal text-signal" /> {review.rating}/5
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-line text-[0.88rem] leading-relaxed">{review.text}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                  <time dateTime={review.createdAt} className="text-[0.75rem] text-muted-foreground">
                    {new Date(review.createdAt).toLocaleString("ru-RU")}
                  </time>
                  <form action={deleteReviewAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <ConfirmButton label="Удалить отзыв" question={`Удалить отзыв ${review.author} на «${review.productTitle}»${review.photo ? " вместе с фотографией" : ""}?`} />
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

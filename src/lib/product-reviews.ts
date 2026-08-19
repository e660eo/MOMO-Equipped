import crypto from "node:crypto";
import { ExpectedError } from "./errors";
import { deleteReviewPhotoSync } from "./review-media";
import { assertWritable, readJson, updateJson } from "./store";
import type { Order, ProductReview, PublicProductReview } from "./types";

const FILE = "reviews.json";

export function getProductReviews(productSlug?: string): ProductReview[] {
  try {
    return readJson<ProductReview[]>(FILE)
      .filter((review) => !productSlug || review.productSlug === productSlug)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getPublicProductReviews(productSlug: string): PublicProductReview[] {
  return getProductReviews(productSlug).map(({ customerId: _customerId, ...review }) => review);
}

export function findCustomerProductReview(
  customerId: string,
  productSlug: string,
): ProductReview | undefined {
  return getProductReviews(productSlug).find((review) => review.customerId === customerId);
}

/**
 * Право появляется только после настоящего списания денег. Тестовая оплата,
 * отменённый заказ, авторизация карты и возврат правом на отзыв не считаются.
 */
export function hasPaidProductPurchase(
  orders: Order[],
  customerId: string,
  productSlug: string,
): boolean {
  return orders.some(
    (order) =>
      order.customerId === customerId &&
      order.status !== "canceled" &&
      order.payment?.status === "CAPTURED" &&
      order.payment.sandbox !== true &&
      order.items.some((item) => item.slug === productSlug && item.qty > 0),
  );
}

/** Сокращает полное имя покупателя, не публикуя его целиком. */
export function publicReviewAuthor(name: string): string {
  const parts = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!parts.length) return "Покупатель";
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

export function addProductReview(
  input: Omit<ProductReview, "id" | "createdAt">,
): ProductReview {
  assertWritable();
  const review: ProductReview = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  updateJson<ProductReview[]>(FILE, (all) => {
    if (
      all.some(
        (item) =>
          item.customerId === review.customerId &&
          item.productSlug === review.productSlug,
      )
    ) {
      throw new ExpectedError("Вы уже оставили отзыв на этот товар.");
    }
    return [review, ...all];
  });
  return review;
}

export function deleteProductReview(id: string): ProductReview | undefined {
  assertWritable();
  const review = getProductReviews().find((item) => item.id === id);
  if (!review) return undefined;
  updateJson<ProductReview[]>(FILE, (all) => all.filter((item) => item.id !== id));
  return review;
}

/** Удаление аккаунта стирает также публичное имя и фотографии из его отзывов. */
export function deleteCustomerProductReviews(customerId: string): string[] {
  const removed = getProductReviews().filter((review) => review.customerId === customerId);
  if (!removed.length) return [];
  assertWritable();
  updateJson<ProductReview[]>(FILE, (all) =>
    all.filter((review) => review.customerId !== customerId),
  );
  for (const review of removed) {
    if (review.photo) deleteReviewPhotoSync(review.photo);
  }
  return [...new Set(removed.map((review) => review.productSlug))];
}

"use server";

import { revalidatePath } from "next/cache";
import { currentCustomer } from "@/lib/customer-auth";
import { getProduct } from "@/lib/data";
import { ExpectedError, messageFor } from "@/lib/errors";
import { getOrders } from "@/lib/orders";
import {
  addProductReview,
  findCustomerProductReview,
  hasPaidProductPurchase,
  publicReviewAuthor,
} from "@/lib/product-reviews";
import { deleteReviewPhoto, saveReviewPhoto } from "@/lib/review-media";
import { assertWritable } from "@/lib/store";
import type { ProductReview } from "@/lib/types";

export type ReviewEligibility =
  | { status: "eligible" }
  | { status: "login_required" }
  | { status: "not_purchased" }
  | { status: "already_reviewed" };

export type ReviewActionState = { error?: string; success?: boolean };

export async function getReviewEligibility(
  productSlug: string,
): Promise<ReviewEligibility> {
  const customer = await currentCustomer();
  if (!customer) return { status: "login_required" };
  if (findCustomerProductReview(customer.id, productSlug)) {
    return { status: "already_reviewed" };
  }
  if (!hasPaidProductPurchase(getOrders(), customer.id, productSlug)) {
    return { status: "not_purchased" };
  }
  return { status: "eligible" };
}

export async function submitProductReview(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  let uploadedPhoto: string | undefined;
  let committed = false;

  try {
    const customer = await currentCustomer();
    if (!customer) throw new ExpectedError("Войдите в аккаунт, чтобы оставить отзыв.");
    assertWritable();

    const productSlug = String(formData.get("productSlug") ?? "").trim().slice(0, 180);
    const product = getProduct(productSlug);
    if (!product) throw new ExpectedError("Товар не найден — обновите страницу.");
    if (findCustomerProductReview(customer.id, productSlug)) {
      throw new ExpectedError("Вы уже оставили отзыв на этот товар.");
    }
    if (!hasPaidProductPurchase(getOrders(), customer.id, productSlug)) {
      throw new ExpectedError("Отзыв можно оставить только после оплаты заказа с этим товаром.");
    }

    const rating = Number(formData.get("rating"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ExpectedError("Поставьте оценку от 1 до 5.");
    }

    const text = String(formData.get("text") ?? "").trim();
    if (text.length < 10) throw new ExpectedError("Напишите хотя бы 10 символов об опыте использования.");
    if (text.length > 1500) throw new ExpectedError("Отзыв длиннее 1500 символов — сократите текст.");

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      uploadedPhoto = await saveReviewPhoto(photo);
    }

    addProductReview({
      productSlug,
      productTitle: product.title,
      customerId: customer.id,
      author: publicReviewAuthor(customer.name),
      rating: rating as ProductReview["rating"],
      text,
      ...(uploadedPhoto ? { photo: uploadedPhoto } : {}),
    });
    committed = true;
    revalidatePath(`/product/${productSlug}`);
    revalidatePath("/admin/reviews");
    return { success: true };
  } catch (error) {
    if (uploadedPhoto && !committed) await deleteReviewPhoto(uploadedPhoto);
    return {
      error: messageFor(
        error,
        "Не удалось опубликовать отзыв. Попробуйте ещё раз.",
        "submitProductReview",
      ),
    };
  }
}

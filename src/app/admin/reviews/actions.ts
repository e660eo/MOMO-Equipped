"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit-log";
import { deleteProductReview } from "@/lib/product-reviews";
import { deleteReviewPhoto } from "@/lib/review-media";
import { assertWritable } from "@/lib/store";

export async function deleteReviewAction(formData: FormData): Promise<void> {
  await requireSession();
  assertWritable();
  const id = String(formData.get("id") ?? "").trim();
  const review = deleteProductReview(id);
  if (review) {
    if (review.photo) await deleteReviewPhoto(review.photo);
    audit({
      entity: "review",
      entityId: review.id,
      action: "deleted",
      summary: `Удалён отзыв на «${review.productTitle}»`,
      before: review,
    });
    revalidatePath(`/product/${review.productSlug}`);
  }
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?deleted=1");
}

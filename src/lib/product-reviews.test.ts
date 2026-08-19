import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addProductReview,
  deleteCustomerProductReviews,
  getProductReviews,
  hasPaidProductPurchase,
  publicReviewAuthor,
} from "./product-reviews";
import type { Order, PaymentStatus } from "./types";

function order(input: {
  customerId?: string;
  productSlug?: string;
  status?: Order["status"];
  paymentStatus?: PaymentStatus;
  sandbox?: boolean;
} = {}): Order {
  return {
    id: "1908-001",
    createdAt: "2026-08-19T10:00:00.000Z",
    status: input.status ?? "new",
    customerId: input.customerId ?? "customer-1",
    customer: { name: "Иван", phone: "+7", address: "Адрес" },
    items: [{ slug: input.productSlug ?? "speaker", title: "Динамик", price: 1000, qty: 1 }],
    total: 1000,
    payment: {
      status: input.paymentStatus ?? "CAPTURED",
      amount: 1000,
      updatedAt: "2026-08-19T10:01:00.000Z",
      sandbox: input.sandbox ?? false,
    },
  };
}

describe("verified product reviews", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-reviews-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
    fs.mkdirSync(path.join(tempDir, "uploads"));
    fs.writeFileSync(path.join(tempDir, "reviews.json"), "[]\n");
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("opens reviews only for the paid non-test order of this customer and product", () => {
    expect(hasPaidProductPurchase([order()], "customer-1", "speaker")).toBe(true);
    expect(hasPaidProductPurchase([order({ customerId: "other" })], "customer-1", "speaker")).toBe(false);
    expect(hasPaidProductPurchase([order({ productSlug: "amplifier" })], "customer-1", "speaker")).toBe(false);
    expect(hasPaidProductPurchase([order({ paymentStatus: "AUTHORIZED" })], "customer-1", "speaker")).toBe(false);
    expect(hasPaidProductPurchase([order({ paymentStatus: "REFUNDED" })], "customer-1", "speaker")).toBe(false);
    expect(hasPaidProductPurchase([order({ sandbox: true })], "customer-1", "speaker")).toBe(false);
    expect(hasPaidProductPurchase([order({ status: "canceled" })], "customer-1", "speaker")).toBe(false);
  });

  it("allows only one review from a customer for a product", () => {
    addProductReview({
      productSlug: "speaker",
      productTitle: "Динамик",
      customerId: "customer-1",
      author: "Иван И.",
      rating: 5,
      text: "Отличный чистый звук.",
    });
    expect(() => addProductReview({
      productSlug: "speaker",
      productTitle: "Динамик",
      customerId: "customer-1",
      author: "Иван И.",
      rating: 4,
      text: "Повторный отзыв.",
    })).toThrow("уже оставили отзыв");
    expect(getProductReviews("speaker")).toHaveLength(1);
  });

  it("removes reviews and photos when the customer deletes the account", () => {
    const photo = "review-00000000-0000-4000-8000-000000000001.webp";
    fs.writeFileSync(path.join(tempDir, "uploads", photo), "photo");
    addProductReview({
      productSlug: "amplifier",
      productTitle: "Усилитель",
      customerId: "customer-delete",
      author: "Анна П.",
      rating: 5,
      text: "Работает стабильно и громко.",
      photo,
    });

    expect(deleteCustomerProductReviews("customer-delete")).toEqual(["amplifier"]);
    expect(getProductReviews("amplifier")).toHaveLength(0);
    expect(fs.existsSync(path.join(tempDir, "uploads", photo))).toBe(false);
  });

  it("publishes only a shortened customer name", () => {
    expect(publicReviewAuthor("Иван Иванов")).toBe("Иван И.");
    expect(publicReviewAuthor("  Анна  ")).toBe("Анна");
  });
});

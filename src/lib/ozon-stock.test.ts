import { describe, expect, it } from "vitest";
import { buildOzonStockRows, validateOzonSellerCredentials } from "./ozon-stock";

describe("Ozon stock sync", () => {
  it("validates seller credentials without exposing the API key", () => {
    expect(validateOzonSellerCredentials(" 123456 ", "a-valid-api-key-value-1234567890 ")).toEqual({
      clientId: "123456",
      apiKey: "a-valid-api-key-value-1234567890",
    });
    expect(() => validateOzonSellerCredentials("seller", "short")).toThrow("Client ID");
  });

  it("publishes the exact MOMO warehouse stock by seller offer id", () => {
    expect(
      buildOzonStockRows(
        [{ slug: "mr-81", title: "MOMO ZEUS MR-8.1", offerId: "MR-8.1", stock: 7, quantity: 2 }],
        12345,
      ),
    ).toEqual([
      {
        offer_id: "MR-8.1",
        product_id: 0,
        stock: 7,
        warehouse_id: 12345,
      },
    ]);
  });

  it("publishes only the cart quantity for legacy in-stock products", () => {
    expect(
      buildOzonStockRows(
        [{ slug: "mr-81", title: "MOMO ZEUS MR-8.1", offerId: "MR-8.1", inStock: true, quantity: 2 }],
        12345,
      ),
    ).toEqual([
      {
        offer_id: "MR-8.1",
        product_id: 0,
        stock: 2,
        warehouse_id: 12345,
      },
    ]);
  });

  it("does not invent availability when neither stock nor in-stock flag is set", () => {
    expect(() =>
      buildOzonStockRows(
        [{ slug: "mr-81", title: "MOMO ZEUS MR-8.1", offerId: "MR-8.1", quantity: 1 }],
        12345,
      ),
    ).toThrow("не подтверждено наличие");
  });

  it("refuses a cart quantity above the physical stock", () => {
    expect(() =>
      buildOzonStockRows(
        [{ slug: "mr-81", title: "MOMO ZEUS MR-8.1", offerId: "MR-8.1", stock: 1, quantity: 2 }],
        12345,
      ),
    ).toThrow("доступно 1");
  });

  it("requires the Ozon seller offer id", () => {
    expect(() =>
      buildOzonStockRows(
        [{ slug: "mr-81", title: "MOMO ZEUS MR-8.1", stock: 3, quantity: 1 }],
        12345,
      ),
    ).toThrow("не указан артикул Ozon");
  });
});

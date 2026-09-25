import { expect, test, type BrowserContext } from "@playwright/test";
import { applyCartMutation, type CartLine, type CartMutation } from "../../src/lib/cart-sync";

test("cart follows the account between independent devices and recovers unsent edits", async ({ page, browser, baseURL, request }) => {
  test.setTimeout(60_000);
  const slug = "monoblok-bd-1500-1";
  const catalogue = await (await request.get(`/api/catalog/selection?slug=${slug}`)).json();
  const product = catalogue.products[0];
  expect(product).toBeTruthy();
  expect(product.inStock).not.toBe(false);
  const carts = new Map<string, CartLine[]>();
  const applied = new Set<string>();
  const sessions: Array<string | null> = ["alice", "alice"];
  let loseResponse = false;
  async function mockAccount(context: BrowserContext, device: number) {
    await context.route("**/api/customer/me", (route) => route.fulfill({ json: {
      customer: sessions[device] ? { id: sessions[device], name: "Тестовый Покупатель", email: "test@example.com", phone: "+79990000000", bonusBalance: 0 } : null,
      dealer: null,
    } }));
    await context.route("**/api/customer/cart", async (route) => {
      const id = sessions[device];
      if (!id) return route.fulfill({ status: 401, json: {} });
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { customerId: string; mutation: CartMutation };
        if (body.customerId !== id) return route.fulfill({ status: 409, json: {} });
        const key = `${id}:${body.mutation.id}`;
        if (!applied.has(key)) {
          carts.set(id, applyCartMutation(carts.get(id) ?? [], body.mutation));
          applied.add(key);
        }
        if (loseResponse) { loseResponse = false; return route.abort(); }
      }
      return route.fulfill({ json: { customerId: id, items: (carts.get(id) ?? []).map((line) => ({ ...product, ...line })) } });
    });
  }
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await mockAccount(page.context(), 0);
    await mockAccount(second, 1);
    await page.goto(`/product/${slug}`);
    // Wait until login has been resolved, then add through the real product UI.
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("momo-cart") ?? "null")?.state.ownerId)).toBe("alice");
    await page.getByRole("button", { name: "В корзину", exact: true }).first().click();
    await expect.poll(() => carts.get("alice")).toEqual([{ slug, qty: 1 }]);

    const phone = await second.newPage();
    await phone.goto(`${baseURL}/cart`);
    await expect(phone.getByText("Корзина сохранена в аккаунте и доступна на других устройствах.")).toBeVisible();
    await expect(phone.locator("main").getByRole("link", { name: product.title, exact: true })).toBeVisible();
    await phone.getByRole("button", { name: "Прибавить", exact: true }).click();
    await expect.poll(() => carts.get("alice")?.[0]?.qty).toBe(2);
    await page.goto("/cart");
    await expect(page.getByText("Корзина сохранена в аккаунте и доступна на других устройствах.")).toBeVisible();
    await expect(page.locator("main").getByText("2 шт.", { exact: true })).toBeVisible();

    // Server accepted the removal, but the browser lost its response.
    loseResponse = true;
    await phone.getByRole("button", { name: "Удалить из корзины" }).click();
    await expect(phone.getByText(/Не удалось связаться с аккаунтом/)).toBeVisible();
    await phone.reload();
    await expect(phone.getByText("Корзина сохранена в аккаунте и доступна на других устройствах.")).toBeVisible();
    expect(carts.get("alice")).toEqual([]);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText(/В корзине пока пусто/)).toBeVisible();

    await page.goto(`/product/${slug}`);
    await page.getByRole("button", { name: "В корзину", exact: true }).first().click();
    await expect.poll(() => carts.get("alice")?.[0]?.qty).toBe(1);
    sessions[0] = null;
    await page.goto("/cart");
    await expect(page.getByText(/В корзине пока пусто/)).toBeVisible();
    sessions[0] = "bob";
    await page.reload();
    await expect(page.getByText("Корзина сохранена в аккаунте и доступна на других устройствах.")).toBeVisible();
    await expect(page.getByText(/В корзине пока пусто/)).toBeVisible();
    expect(carts.get("bob") ?? []).toEqual([]);
    sessions[0] = "alice";
    await page.reload();
    await expect(page.locator("main").getByRole("link", { name: product.title, exact: true })).toBeVisible();
  } finally { await second.close(); }
});

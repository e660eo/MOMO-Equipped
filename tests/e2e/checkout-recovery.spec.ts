import { expect, test } from "@playwright/test";

// Only the UI runs for real. Every server action, session and map SDK is mocked:
// these scenarios must never create orders, payments or Ozon reservations.
test("checkout recovers from delivery failures and separates payment totals", async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  const item = { slug: "test-speaker", title: "Тестовый динамик", price: 2000, qty: 1, stock: 5, image: "/logo-3d.png" };
  const point = { id: 1, name: "Тестовый ПВЗ", address: "Москва, Тестовая, 1", lat: 55.75, long: 37.61, distanceKm: 1 };
  let mapCalls = 0, searchCalls = 0, pickupCalls = 0;
  const submitted: Array<{ pay: boolean; expectedTotal: number; deliveryToken?: string }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin) return route.abort();
    if (url.pathname === "/api/customer/me") return route.fulfill({ json: {
      customer: { id: "test-customer", name: "Тестовый Покупатель", phone: "+79990000000", email: "test@example.com", emailVerifiedAt: "2026-09-01", bonusBalance: 0 }, dealer: null,
    } });
    if (request.method() === "POST") {
      if (!request.headers()["next-action"]) return route.abort();
      const [arg] = JSON.parse(request.postData()!);
      let result: unknown;
      if (arg?.viewport) {
        if (++mapCalls === 1) return route.abort("failed");
        result = { ok: true, area: { points: [point], clusters: [] } };
      } else if (typeof arg === "string") {
        if (++searchCalls === 1) return route.abort("failed");
        result = { ok: true, places: [{ id: "moscow", label: "Москва", lat: 55.75, long: 37.61, zoom: 11 }] };
      } else if (arg?.pointId) {
        if (++pickupCalls === 1) return route.abort("failed");
        result = { ok: true, delivery: { provider: "ozon", type: "pickup", point, customerPrice: 300, token: `token-${pickupCalls}` } };
      } else if (Array.isArray(arg)) {
        result = [item];
      } else if (arg?.items && typeof arg.pay === "boolean") {
        submitted.push(arg);
        result = arg.pay
          ? { ok: false, requiresDeliveryRefresh: true, error: "Платёжная ссылка не создана. Подтвердите ПВЗ ещё раз." }
          : { ok: false, error: "Тестовая заявка: отправка отключена." };
      } else {
        throw new Error(`Unexpected checkout action: ${request.postData()}`);
      }
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":"","b":"test"}\n1:${JSON.stringify(result)}\n` });
    }
    if (request.isNavigationRequest() && url.pathname === "/cart") {
      const response = await route.fetch();
      const body = (await response.text())
        .replaceAll('\\"payEnabled\\":false', '\\"payEnabled\\":true')
        .replaceAll('\\"yandexMapsApiKey\\":null', '\\"yandexMapsApiKey\\":\\"test-map-key\\"');
      return route.fulfill({ response, body });
    }
    return route.continue();
  });
  await page.addInitScript(({ item }) => {
    localStorage.setItem("momo-cart", JSON.stringify({ state: { items: [item] }, version: 0 }));
    localStorage.setItem("momo-city", "Москва");
    Object.defineProperty(window, "ymaps", { value: {
      ready: (fn: () => void) => fn(),
      Map: class {
        events = { add() {}, remove() {} };
        geoObjects = { add() {}, removeAll() {} };
        getCenter() { return [55.75, 37.61]; }
        getZoom() { return 11; }
        getBounds() { return [[55.7, 37.5], [55.8, 37.7]]; }
        setCenter() {}
        destroy() {}
      },
      Placemark: class { events = { add() {} }; },
      templateLayoutFactory: { createClass() {} },
    } });
  }, { item });
  await page.goto("/cart");
  await expect(page.getByText(/Не удалось загрузить ПВЗ/)).toBeVisible();
  await page.getByRole("button", { name: "Показать ПВЗ здесь", exact: true }).click();
  await page.getByRole("button", { name: /Тестовый ПВЗ/ }).click();

  const search = page.getByRole("button", { name: "Найти", exact: true });
  await page.getByLabel("Город или адрес для поиска ПВЗ Ozon").fill("Москва");
  await search.click();
  await expect(page.getByText(/Не удалось найти адрес/)).toBeVisible();
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByRole("button", { name: "Москва", exact: true })).toBeVisible();

  const confirm = page.getByRole("button", { name: "Подтвердить выбранный ПВЗ", exact: true });
  await confirm.click();
  await expect(page.getByText(/Не удалось подтвердить ПВЗ/)).toBeVisible();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByText(/ПВЗ подтверждён/)).toBeVisible();
  await expect(page.getByText("Итого к онлайн-оплате").locator("..")).toContainText(/2\s*300/);
  await expect(page.locator("#offline-order-total")).toContainText(/2\s*000/);
  await expect(page.locator("#offline-order-total")).toContainText("Доставка в сумму заявки не включена");
  await page.locator("#rc-consent").check();
  await page.getByRole("button", { name: "Оплатить на сайте", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Не удалось продолжить" })).toContainText("Платёжная ссылка не создана");
  await expect(confirm).toBeEnabled();
  await expect(page.getByText(/ПВЗ подтверждён/)).toHaveCount(0);
  await confirm.click();
  await expect(page.getByText(/ПВЗ подтверждён/)).toBeVisible();
  await page.getByRole("button", { name: "Оплатить на сайте", exact: true }).click();
  await expect.poll(() => submitted.length).toBe(2);
  expect(submitted[0]).toMatchObject({ pay: true, expectedTotal: 2300, deliveryToken: "token-2" });
  expect(submitted[1]).toMatchObject({ pay: true, expectedTotal: 2300, deliveryToken: "token-3" });

  await confirm.click();
  await expect(page.getByText(/ПВЗ подтверждён/)).toBeVisible();
  await page.getByRole("button", { name: "Заказать без онлайн-оплаты", exact: true }).click();
  await expect.poll(() => submitted.length).toBe(3);
  expect(submitted[2]).toMatchObject({ pay: false, expectedTotal: 2000 });
  expect(submitted[2].deliveryToken).toBeUndefined();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
});

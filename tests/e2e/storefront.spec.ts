import { expect, test } from "@playwright/test";

test("homepage explains the offer and warranty policy", async ({ page }) => {
  const blockedScripts: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute)/i.test(message.text())) {
      blockedScripts.push(message.text());
    }
  });
  const response = await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Звук, который чувствуешь");
  const heroLogo = page.locator('img[alt="Modern Original Music Organization"]').first();
  await expect(heroLogo).toBeVisible();
  expect(await heroLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("Автоакустика MOMO и ZEUS", { exact: true })).toBeVisible();
  await expect(page.getByText(/24 мес.*авторизованной установкой/i).first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /momo-eq\.ru\/?$/);
  if (process.env.PLAYWRIGHT_PRODUCTION === "1") {
    expect(response?.headers()["cache-control"]).toContain("s-maxage");
    expect(blockedScripts).toEqual([]);
  }
});

test("catalogue keeps service fields out of HTML and serves search results", async ({ page, request }) => {
  const response = await page.goto("/catalog");
  expect(response?.ok()).toBeTruthy();
  const html = await response!.text();
  expect(html).not.toContain("ozonOfferId");
  expect(html).not.toContain("ozonSku");

  const search = await request.get("/api/search?q=сабвуфер&limit=3");
  expect(search.ok()).toBeTruthy();
  const body = await search.json();
  expect(body.hits.length).toBeGreaterThan(0);
  expect(body.hits.length).toBeLessThanOrEqual(3);

  if (process.env.PLAYWRIGHT_PRODUCTION === "1") {
    const filtered = await request.get("/catalog?brand=MOMO");
    expect(filtered.headers()["cache-control"]).toContain("s-maxage");
    expect(filtered.headers()["x-robots-tag"]).toBe("noindex, follow");
  }
});

test("updated speaker arrivals are visible with the confirmed prices and specifications", async ({ page }) => {
  await page.goto("/");
  const arrivals = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Новинки MOMO" }),
  });
  await expect(arrivals.getByRole("link", { name: /MOMO HE-810/ }).first()).toBeVisible();
  await expect(arrivals.getByText(/4\s640\s₽/)).toBeVisible();
  await expect(arrivals.getByRole("link", { name: /MOMO HE-815/ }).first()).toBeVisible();
  await expect(arrivals.getByText(/5\s280\s₽/)).toBeVisible();
  await expect(arrivals.getByRole("link", { name: /ZEUS MR-8.1/ }).first()).toBeVisible();
  await expect(arrivals.getByText(/2\s201\s₽/)).toBeVisible();

  await page.goto("/news/novinki-momo-2026");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Новинки: обновлённые MOMO HE-810, HE-815 и ZEUS MR-8.1",
  );
  await expect(page.getByText("Номинальная мощность: 170 Вт", { exact: true })).toBeVisible();

  await page.goto("/product/dinamiki-estradnye-momo-he-815-20sm");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MOMO HE-815");
  await expect(page.getByText("210 мм", { exact: true })).toBeVisible();
  await expect(
    page.getByText("170 Вт", { exact: true }),
  ).toBeVisible();
});

test("product page exposes Product structured data", async ({ page }) => {
  await page.goto("/product/hid-ksenonovaya-lampa-h4-3000-3200lm-5000-6000k-23000vt-zeus-857896");
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schemas.some((schema) => schema.includes('"@type":"Product"'))).toBeTruthy();
});

test("mobile layout has no horizontal overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("checkout uses native form semantics and field-linked errors", async ({ page }) => {
  await page.goto("/product/monoblok-bd-1500-1");
  await page.getByRole("button", { name: "В корзину" }).first().click();
  await page.goto("/cart");

  const form = page.locator("form").filter({ has: page.locator("#rc-name") });
  await expect(form).toBeVisible();
  await expect(page.locator("#rc-name")).toHaveAttribute("required", "");
  await expect(page.locator("#rc-phone")).toHaveAttribute("required", "");
  await expect(page.locator("#rc-address")).toHaveAttribute("required", "");

  await form.getByRole("button", { name: "Оформить заказ" }).click();
  const summary = page.getByRole("alert", { name: "Не удалось продолжить" });
  await expect(summary).toContainText("Проверьте отмеченные поля");
  await expect(summary).toBeFocused();
  await expect(page.locator("#rc-name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#rc-name-error")).toContainText("Укажите фамилию");
});

test("catalogue stores interactive filters in the URL", async ({ page, isMobile }) => {
  await page.goto("/catalog");
  if (isMobile) await page.getByRole("button", { name: "Фильтры и сортировка" }).click();
  await page.getByLabel("Поиск по товарам").fill("сабвуфер");
  await page.getByLabel("Сортировка").selectOption("price_asc");
  await page.getByText("Только в наличии").click();

  await expect(page).toHaveURL(/search=%D1%81%D0%B0%D0%B1%D0%B2%D1%83%D1%84%D0%B5%D1%80/);
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page).toHaveURL(/stock=1/);
  await page.reload();
  await expect(page.getByLabel("Поиск по товарам")).toHaveValue("сабвуфер");
  await expect(page.getByLabel("Сортировка")).toHaveValue("price_asc");
});

test("category HTML links every product without JavaScript", async ({ request }) => {
  const response = await request.get("/catalog/aksessuary");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  const links = new Set(
    [...html.matchAll(/href="\/product\/([^"]+)"/g)].map((match) => match[1]),
  );
  expect(links.size).toBeGreaterThanOrEqual(64);
});

test("analytics is gated by an explicit consent choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('script[src="/yandex-metrica.js"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Только необходимые" }).click();
  await page.reload();
  await expect(page.locator('script[src="/yandex-metrica.js"]')).toHaveCount(0);

  await page.evaluate(() => localStorage.removeItem("momo-cookie-consent"));
  await page.reload();
  await page.getByRole("button", { name: "Разрешить аналитику" }).click();
  await expect(page.locator('script[src="/yandex-metrica.js"]')).toHaveCount(1);
});

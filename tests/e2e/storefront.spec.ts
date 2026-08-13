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
  const heroLogo = page.locator('img[alt="MOMO Equipped"]').first();
  await expect(heroLogo).toBeVisible();
  expect(await heroLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("Автоакустика MOMO и ZEUS", { exact: true })).toBeVisible();
  await expect(page.getByText("Сабвуферы, усилители, динамики и готовые системы автозвука.")).toBeVisible();
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

test("new arrivals are visible with the confirmed prices and specifications", async ({ page }) => {
  await page.goto("/");
  const arrivals = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Новинки MOMO" }),
  });
  await expect(arrivals.getByRole("link", { name: /Моноблок FR-500/ }).first()).toBeVisible();
  await expect(arrivals.getByText(/4\s000\s₽/)).toBeVisible();
  await expect(arrivals.getByRole("link", { name: /Моноблок BD-1500.1/ }).first()).toBeVisible();
  await expect(arrivals.getByText(/9\s184\s₽/)).toBeVisible();

  await page.goto("/news/novinki-momo-2026");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Новинки MOMO: FR-500 и BD-1500.1",
  );
  await expect(page.getByText("RMS при 1 Ом: 1450 Вт", { exact: true })).toBeVisible();

  await page.goto("/product/monoblok-bd-1500-1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Моноблок BD-1500.1");
  await expect(page.getByText("1 Ом", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1450 Вт · 2 Ом: 1050 Вт · 4 Ом: 650 Вт", { exact: true }),
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

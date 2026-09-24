import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("momo-cookie-consent", "declined"));
});

test("search distinguishes loading, failure, retry and an empty result", async ({ page, isMobile }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let fail = true;
  await page.route("**/api/search?**", async (route) => {
    await pending;
    if (fail) await route.fulfill({ status: 503, body: "unavailable" });
    else await route.fulfill({ json: { hits: [], total: 0 } });
  });
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Меню", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Поиск товаров", exact: true });
  await field.fill("сабвуфер");
  await expect(page.getByText("Ищем…", { exact: true })).toBeVisible();
  await expect(page.getByText(/Ничего не нашлось/)).toHaveCount(0);
  release();
  await expect(page.getByText(/Не удалось загрузить подсказки/)).toBeVisible();
  await expect(page.getByText(/Ничего не нашлось/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Открыть каталог", exact: true })).toHaveAttribute("href", /search=/);
  fail = false;
  await page.getByRole("button", { name: "Повторить поиск", exact: true }).click();
  await expect(page.getByText("Ничего не нашлось по запросу «сабвуфер»", { exact: true })).toBeVisible();
  await expect(page.getByText(/Не удалось загрузить подсказки/)).toHaveCount(0);
});

test("a newer query never displays an older result", async ({ page, isMobile }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/search?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "второй") await pending;
    await route.fulfill({ json: {
      hits: [{ slug: "fixture", title: query === "первый" ? "Первая модель" : "Вторая модель", brand: "MOMO", category: "sabvufery", price: 1000, image: "/placeholder.svg" }], total: 1,
    } });
  });
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Меню", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Поиск товаров", exact: true });
  await field.fill("первый");
  await expect(page.getByText("Первая модель", { exact: true })).toBeVisible();
  await field.fill("второй");
  await expect(page.getByText("Ищем…", { exact: true })).toBeVisible();
  await expect(page.getByText("Первая модель", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText("Вторая модель", { exact: true })).toBeVisible();
});

test("all search results close the mobile menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile navigation only");
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  await menu.click();
  await page.getByRole("textbox", { name: "Поиск товаров", exact: true }).fill("сабвуфер");
  await page.getByRole("link", { name: /Показать все результаты/ }).click();
  await expect(page).toHaveURL(/\/catalog\?search=/, { timeout: 15_000 });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Каталог", level: 1, exact: true })).toBeVisible();
});

test("banner pause persists after focus leaves and autoplay can resume", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Остановить смену баннеров", exact: true }).click();
  const status = page.getByText(/^Показан баннер \d+ из \d+$/);
  const initial = await status.innerText();
  // Move both focus and pointer outside: the explicit pause must be sufficient.
  await page.getByRole("heading", { level: 1 }).click();
  await page.clock.runFor(8000);
  await expect(status).toHaveText(initial);
  await page.getByRole("button", { name: "Включить смену баннеров", exact: true }).click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(status).toHaveAttribute("aria-live", "off");
  await page.clock.runFor(8000);
  await expect(status).not.toHaveText(initial);
});

test("reduced motion disables automatic banner rotation until requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const resume = page.getByRole("button", { name: "Включить смену баннеров", exact: true });
  await expect(resume).toBeVisible();
  const status = page.getByText(/^Показан баннер \d+ из \d+$/);
  const initial = await status.innerText();
  await page.clock.runFor(8000);
  await expect(status).toHaveText(initial);
  await resume.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(status).toHaveAttribute("aria-live", "off");
  await page.clock.runFor(8000);
  await expect(status).not.toHaveText(initial);
});

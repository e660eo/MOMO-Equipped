import { expect, test } from "@playwright/test";

test("online stand uses MOMO/ZEUS catalogue and labels the reference track honestly", async ({ page }) => {
  const response = await page.goto("/listening-stand");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /Услышьте характер/i })).toBeVisible();
  await expect(page.getByText(/22 модел/)).toBeVisible();
  await expect(page.getByText(/без имитации звучания динамика/i)).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute("src", "/audio/momo-reference-loop.wav");

  await page.getByPlaceholder("Найти модель MOMO или ZEUS").fill("ZEUS AC-165");
  await expect(page.getByText("Динамики коаксиальные ZEUS AC-165", { exact: true })).toBeVisible();
  await expect(page.getByText(/из 22/)).toBeVisible();
});

test("online stand has no horizontal overflow on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/listening-stand");
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

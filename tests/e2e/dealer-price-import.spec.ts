import crypto from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const secret = process.env.MOMO_DEALER_E2E_SECRET;
test.skip(!secret || process.env.MOMO_DEALER_IMPORT_E2E !== "1", "Requires explicit isolated local dealer import fixture.");

async function requestHeadersWithinDeadline(promise: Promise<Record<string, string>>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<Record<string, string>>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Upload request headers were unavailable after 10 seconds")), 10_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

test("admin reviews compact Excel, applies it once, and rejects a stale second preview", async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const payload = `1.${Date.now() + 3_600_000}`;
  const token = `${payload}.${crypto.createHmac("sha256", secret!).update(`admin:${payload}`).digest("base64url")}`;
  await context.addCookies([{ name: "momo_admin", value: token, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  const file = process.env.MOMO_DEALER_E2E_EXCEL || path.join(process.cwd(), "src/lib/__fixtures__/dealer-price-2026-09-24.xlsx");
  async function upload(target: Page) {
    await target.goto("/admin/dealer-prices");
    await target.getByLabel("Новый дилерский прайс (.xlsx)").setInputFiles(file);
    const response = target.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/dealer-prices"));
    await target.getByRole("button", { name: "Загрузить и проверить" }).click();
    const uploadResponse = await response;
    // Chromium omits multipart file bytes from postDataBuffer. The actual HTTP
    // Content-Length includes file bytes and multipart framing, without waiting
    // for Next's streamed action response to close.
    const headers = await requestHeadersWithinDeadline(uploadResponse.request().allHeaders());
    const uploadSize = Number(headers["content-length"]);
    expect(uploadSize).toBeGreaterThan(0);
    expect(uploadSize).toBeLessThan(512 * 1024);
    await expect(target.getByRole("heading", { name: "Проверьте изменения" })).toBeVisible();
    await expect(target.getByText("Без изменений: 106", { exact: true })).toBeVisible();
    await expect(target.getByText(/Отрезки кабеля исключены: 29/)).toBeVisible();
  }
  await upload(page);
  const second = await context.newPage();
  try {
    await upload(second);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Применить проверенный прайс" }).click();
    await expect(page.getByRole("status")).toContainText("Прайс обновлён: 106 позиций.");
    await second.getByRole("checkbox").check();
    await second.getByRole("button", { name: "Применить проверенный прайс" }).click();
    await expect(second.getByRole("alert").filter({ hasText: "Прайс или каталог уже изменился после предпросмотра" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Сейчас в прайсе: 106 позиций", { exact: true })).toBeVisible();
  } finally { await second.close(); }
});

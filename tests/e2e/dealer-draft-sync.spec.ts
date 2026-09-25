import crypto from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";

const secret = process.env.MOMO_DEALER_E2E_SECRET;
const accountId = process.env.MOMO_DEALER_E2E_ACCOUNT;
test.skip(!secret || !accountId, "Requires the isolated dealer fixture and local session secret.");

function token(id: string) {
  const fingerprint = crypto.createHash("sha256").update("dealer-e2e-test-hash").digest("base64url").slice(0, 12);
  const payload = `${id}.${Date.now() + 3_600_000}.${fingerprint}`;
  return `${payload}.${crypto.createHmac("sha256", secret!).update(`dealer:${payload}`).digest("base64url")}`;
}

test("dealer draft syncs independent devices, survives a lost response, and isolates shared-computer accounts", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  async function signIn(context: BrowserContext, id: string) {
    await context.addCookies([{ name: "momo_dealer", value: token(id), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  }
  async function clearDraft(context: BrowserContext, id: string) {
    const response = await context.request.get(`${baseURL}/api/dealer/draft`);
    expect(response.ok()).toBe(true);
    const { draft } = await response.json();
    const cleared = await context.request.post(`${baseURL}/api/dealer/draft`, {
      headers: { Origin: baseURL! }, data: { accountId: id, mutation: { id: crypto.randomUUID(), mode: "consume", lines: Object.entries(draft.quantities).map(([slug, qty]) => ({ slug, qty })), comment: draft.comment } },
    });
    expect(cleared.ok()).toBe(true);
  }
  try {
    await signIn(page.context(), accountId!);
    await signIn(second, accountId!);
    await clearDraft(page.context(), accountId!);
    await page.goto("/dealer/order");
    await expect(page.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    const quantity = page.locator('input[aria-label^="Количество:"]:enabled').first();
    const label = (await quantity.getAttribute("aria-label"))!;
    await quantity.fill("2");
    await page.getByLabel("Комментарий менеджеру").fill("Доставка до терминала");
    await expect(page.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    const phone = await second.newPage();
    await phone.goto(`${baseURL}/dealer/order`);
    await expect(phone.getByLabel(label, { exact: true })).toHaveValue("2");
    await expect(phone.getByLabel("Комментарий менеджеру")).toHaveValue("Доставка до терминала");
    await phone.getByLabel(label, { exact: true }).fill("3");
    await expect(phone.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(quantity).toHaveValue("3");

    let loseResponse = true;
    await second.route("**/api/dealer/draft", async (route) => {
      if (loseResponse && route.request().method() === "POST") {
        loseResponse = false;
        await route.fetch(); // The server commits the edit before the response disappears.
        return route.abort();
      }
      return route.continue();
    });
    await phone.getByLabel(label, { exact: true }).fill("4");
    await expect(phone.getByText(/Нет связи. Изменения ждут синхронизации/)).toBeVisible();
    await phone.reload();
    await expect(phone.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    await expect(phone.getByLabel(label, { exact: true })).toHaveValue("4");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(quantity).toHaveValue("4");

    await page.context().setOffline(true);
    await quantity.fill("5");
    await expect(page.getByText(/Нет связи. Изменения ждут синхронизации/)).toBeVisible();
    await signIn(page.context(), "dealer-e2e-other");
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Комментарий менеджеру")).toHaveValue("");
    await signIn(page.context(), accountId!);
    await page.reload();
    await expect(page.getByText("Черновик сохранён в аккаунте", { exact: true })).toBeVisible();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("5");
  } finally {
    await page.context().setOffline(false);
    await second.close();
  }
});

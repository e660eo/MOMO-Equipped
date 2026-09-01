import { expect, test } from "@playwright/test";

test("visitor can open support and send a message without leaving the site", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const launcher = page.getByRole("button", { name: "Открыть поддержку" });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const dialog = page.getByRole("dialog", { name: "Поддержка MOMO" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Ваше имя").fill("Тестовый клиент");
  await dialog.getByLabel("Телефон или email").fill("client@example.com");
  await dialog.getByRole("textbox", { name: "Сообщение", exact: true }).fill("Нужна помощь с подбором усилителя");
  await dialog.getByLabel(/Согласен на обработку/).check();
  const sent = page.waitForResponse((response) =>
    response.url().endsWith("/api/support/chat") &&
    response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Отправить сообщение" }).click();
  expect((await sent).ok()).toBeTruthy();

  await expect(dialog.getByText("Нужна помощь с подбором усилителя")).toBeVisible();
  await expect(dialog.getByText(/CHAT-\d{6}-[A-F0-9]{6}/)).toBeVisible();
  await expect(dialog.getByText(/откроет его снова/i)).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("support-chat.png"), fullPage: false });
});

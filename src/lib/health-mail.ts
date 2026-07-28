import { sendMailWithRetry, isMailerConfigured } from "./mailer";
import { SITE_URL } from "./site-url";
import { escapeHtml } from "./sanitize";
import type { HealthReport } from "./health";

/*
  Письмо владельцу, когда само-диагностика сайта нашла отказ (см. health.ts).

  Шлём только на уровень fail — «сайт работает, но теряет данные»: некуда
  писать заказы, кончился диск. warn (нет свежего бэкапа, не подключена почта)
  письмом не тревожим, чтобы не приучать пропускать эти письма мимо глаз;
  такие вещи видны в панели.

  Ограничение честное: если сломана как раз почта или папка данных, письмо
  может не уйти. Поэтому оно — не единственная линия обороны, а дополнение к
  внешнему монитору, который опрашивает сайт снаружи.
*/

const esc = escapeHtml;
const panelUrl = `${SITE_URL}/admin`;

export async function notifyHealthProblem(report: HealthReport): Promise<void> {
  if (!isMailerConfigured()) return;

  const bad = report.checks.filter((c) => c.level !== "ok");
  if (bad.length === 0) return;

  const lines = bad.map((c) => `• ${c.label}: ${c.detail}`);

  const text = [
    "На сайте momo-eq.ru обнаружена проблема.",
    "",
    ...lines,
    "",
    "Сам сайт для покупателей, скорее всего, ещё работает, но что-то под ним",
    "сломано — загляните в панель.",
    "",
    `Панель: ${panelUrl}`,
  ].join("\n");

  const item = "margin:0 0 8px;font-size:14px;line-height:1.6;";
  const html = `
<div style="margin:0;padding:24px 16px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#151515;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#c0341d;">На сайте проблема</h1>
    ${bad
      .map(
        (c) =>
          `<p style="${item}"><b style="font-weight:600;">${esc(c.label)}.</b> ${esc(c.detail)}</p>`,
      )
      .join("")}
    <p style="margin:16px 0 0;font-size:13px;color:#767676;line-height:1.6;">
      Сам сайт для покупателей, скорее всего, ещё работает — но что-то под ним
      сломано. Загляните в панель.
    </p>
    <p style="margin:22px 0 0;">
      <a href="${panelUrl}" style="display:inline-block;background:#e2571f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;">Открыть панель</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#767676;">Письмо отправлено сайтом momo-eq.ru автоматически.</p>
  </div>
</div>`.trim();

  try {
    const result = await sendMailWithRetry({
      subject: "⚠️ momo-eq.ru: проблема на сайте",
      text,
      html,
    });
    if (!result.ok) {
      console.error(`Health: письмо о проблеме не ушло — ${result.error}`);
    }
  } catch (e) {
    console.error("Health: сбой отправки письма о проблеме", e);
  }
}

/** Отдельное короткое письмо — «отпустило»: чтобы не гадать, прошло ли. */
export async function notifyHealthRecovered(): Promise<void> {
  if (!isMailerConfigured()) return;

  try {
    const result = await sendMailWithRetry({
      subject: "✅ momo-eq.ru: проблема устранена",
      text: [
        "Проблема, о которой приходило письмо, больше не наблюдается.",
        "",
        `Панель: ${panelUrl}`,
      ].join("\n"),
      html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
  <p style="font-size:18px;color:#177245;"><b>Проблема устранена</b></p>
  <p>То, о чём приходило предыдущее письмо, больше не наблюдается. Сайт в норме.</p>
</div>`,
    });
    if (!result.ok) {
      console.error(`Health: письмо о восстановлении не ушло — ${result.error}`);
    }
  } catch (e) {
    console.error("Health: сбой отправки письма о восстановлении", e);
  }
}

import { getAdminAlerts } from "./admin-alerts";
import { sendMailWithRetry, isMailerConfigured } from "./mailer";
import { readJson, writeJson } from "./store";
import { escapeHtml } from "./sanitize";

const FILE = "notification-state.json";
let timer: ReturnType<typeof setInterval> | undefined;

interface State { fingerprint: string; sentAt: string }

async function check(): Promise<void> {
  if (!isMailerConfigured()) return;
  const alerts = getAdminAlerts().filter((alert) => alert.level !== "info");
  if (!alerts.length) return;
  const fingerprint = alerts.map((alert) => `${alert.id}:${alert.title}`).join("|");
  let previous: State | undefined;
  try { previous = readJson<State>(FILE); } catch { /* первое уведомление */ }
  if (previous?.fingerprint === fingerprint) return;
  const text = alerts.map((alert) => `${alert.title}: ${alert.detail}`).join("\n");
  const result = await sendMailWithRetry({
    subject: `MOMO: требуется внимание (${alerts.length})`,
    text: `${text}\n\nОткрыть панель: /admin`,
    html: `<h2>Панель MOMO требует внимания</h2><ul>${alerts.map((alert) => `<li><b>${escapeHtml(alert.title)}</b><br>${escapeHtml(alert.detail)}</li>`).join("")}</ul>`,
  });
  if (result.ok) writeJson(FILE, { fingerprint, sentAt: new Date().toISOString() } satisfies State);
}

export function scheduleAdminNotifications(): void {
  if (timer) return;
  void check().catch((error) => console.error("[admin-notifications]", error));
  timer = setInterval(() => void check().catch((error) => console.error("[admin-notifications]", error)), 15 * 60_000);
  timer.unref?.();
}


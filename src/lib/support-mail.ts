import { isMailerConfigured, sendMailWithRetry, type Letter } from "./mailer";
import { escapeHtml } from "./sanitize";
import { SITE_URL } from "./site-url";
import type { SupportChatMessage, SupportConversation } from "./types";

const TZ = "Europe/Moscow";

function moscowTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function replyAddress(contact: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;
}

export function buildSupportMessageLetter(
  conversation: SupportConversation,
  message: SupportChatMessage,
): Letter {
  const chatUrl = `${SITE_URL}/admin/messages?chat=${encodeURIComponent(conversation.id)}`;
  const when = moscowTime(message.createdAt);
  const text = [
    `Новое сообщение в чате от ${conversation.name}`,
    when,
    "",
    message.text,
    "",
    `Контакт: ${conversation.contact}`,
    `Открыть диалог: ${chatUrl}`,
  ].join("\n");

  const html = `
<div style="margin:0;padding:24px 16px;background:#f1f1f3;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#141414;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#141414;padding:22px 30px;color:#ffffff;font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">MOMO <span style="color:#e2571f;">· чат</span></div>
    <div style="padding:30px;">
      <p style="margin:0 0 5px;color:#e2571f;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Новое сообщение клиента</p>
      <h1 style="margin:0;font-size:27px;line-height:1.15;">${escapeHtml(conversation.name)}</h1>
      <p style="margin:7px 0 22px;color:#777;font-size:13px;">${escapeHtml(when)} · ${escapeHtml(conversation.contact)}</p>
      <div style="padding:18px;border:1px solid #ededed;border-radius:12px;font-size:16px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(message.text)}</div>
      <a href="${chatUrl}" style="display:block;margin-top:24px;background:#e2571f;color:#ffffff;text-decoration:none;text-align:center;font-weight:700;font-size:15px;padding:15px 24px;border-radius:12px;">Открыть диалог →</a>
      <p style="margin:18px 0 0;color:#aaa;font-size:12px;text-align:center;">Автоматическое уведомление · momo-eq.ru</p>
    </div>
  </div>
</div>`.trim();

  return {
    subject: `Новое сообщение в чате — ${conversation.name}`,
    text,
    html,
    ...(replyAddress(conversation.contact) ? { replyTo: conversation.contact } : {}),
  };
}

export async function notifySupportMessage(
  conversation: SupportConversation,
  message: SupportChatMessage,
): Promise<void> {
  if (!isMailerConfigured()) throw new Error("Почтовый ящик не подключён.");
  const result = await sendMailWithRetry(buildSupportMessageLetter(conversation, message));
  if (!result.ok) throw new Error(`Уведомление о сообщении не отправлено: ${result.error}`);
}

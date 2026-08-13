import { findCustomer } from "./customers";
import { makeResetToken } from "./customer-auth";
import { sendMailWithRetry, type Letter } from "./mailer";
import { escapeHtml } from "./sanitize";
import { SITE_URL } from "./site-url";

export function welcomeLetter(input: {
  name: string;
  email: string;
  phone: string;
  resetLink: string;
}): Letter {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const phone = escapeHtml(input.phone);
  const resetLink = escapeHtml(input.resetLink);

  return {
    to: [input.email],
    subject: "Добро пожаловать в MOMO Equipped",
    text: [
      `Здравствуйте, ${input.name}!`,
      "",
      "Ваш аккаунт в MOMO Equipped создан.",
      `Логин по email: ${input.email}`,
      `Логин по телефону: ${input.phone}`,
      "",
      "Пароль в письме не отправляем — это небезопасно.",
      "Если забудете пароль, задайте новый по ссылке (она действует один час):",
      input.resetLink,
      "",
      "После истечения ссылки новую можно запросить в форме входа.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
      <p style="font-size:20px;font-weight:700;margin:0 0 16px;">Добро пожаловать, ${name}!</p>
      <p>Ваш аккаунт в <b>MOMO Equipped</b> создан. Войти можно любым из логинов:</p>
      <div style="margin:16px 0;padding:14px 16px;border:1px solid #e7e3de;border-radius:8px;background:#faf9f7;">
        <div><b>Email:</b> ${email}</div>
        <div style="margin-top:6px;"><b>Телефон:</b> ${phone}</div>
      </div>
      <p>Пароль в письме не отправляем — так его не сможет прочитать посторонний, получивший доступ к почте.</p>
      <p>Если забудете пароль, задайте новый по безопасной ссылке. Она действует один час:</p>
      <p style="margin:20px 0;"><a href="${resetLink}" style="display:inline-block;background:#ff5500;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px;">Задать новый пароль</a></p>
      <p style="color:#767676;font-size:13px;">После истечения ссылки новую можно запросить в форме входа на сайте.</p>
    </div>`,
  };
}

export async function notifyCustomerWelcome(customerId: string): Promise<void> {
  const customer = findCustomer(customerId);
  if (!customer) throw new Error(`Клиент ${customerId} не найден.`);
  const token = makeResetToken(customer.id);
  if (!token) throw new Error("Не удалось создать безопасную ссылку для письма.");
  const resetLink = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const result = await sendMailWithRetry(welcomeLetter({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    resetLink,
  }));
  if (!result.ok) throw new Error(result.error);
}

import { findCustomer } from "./customers";
import { makeEmailVerificationToken, makeResetToken } from "./customer-auth";
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
    subject: "Добро пожаловать в Modern Original Music Organization",
    text: [
      `Здравствуйте, ${input.name}!`,
      "",
      "Ваш аккаунт в Modern Original Music Organization создан.",
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
      <p>Ваш аккаунт в <b>Modern Original Music Organization</b> создан. Войти можно любым из логинов:</p>
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

export function emailVerificationLetter(input: {
  name: string;
  email: string;
  verifyLink: string;
  welcome?: boolean;
}): Letter {
  const name = escapeHtml(input.name);
  const verifyLink = escapeHtml(input.verifyLink);
  return {
    to: [input.email],
    subject: input.welcome
      ? "Добро пожаловать — подтвердите почту в Modern Original Music Organization"
      : "Подтвердите почту — Modern Original Music Organization",
    text: [
      `Здравствуйте, ${input.name}!`,
      "",
      input.welcome ? "Ваш аккаунт Modern Original Music Organization создан." : "Вы запросили подтверждение почты.",
      "Подтвердите адрес по ссылке (она действует 24 часа):",
      input.verifyLink,
      "",
      "До подтверждения почты онлайн-оплата недоступна.",
      "Если это были не вы — просто не открывайте ссылку.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#151515;">
      <p style="font-size:20px;font-weight:700;margin:0 0 16px;">${input.welcome ? "Добро пожаловать" : "Подтвердите почту"}, ${name}!</p>
      <p>${input.welcome ? "Ваш аккаунт <b>Modern Original Music Organization</b> создан." : "Вы запросили подтверждение адреса."} Нажмите кнопку, чтобы подтвердить, что почта принадлежит вам.</p>
      <p style="margin:22px 0;"><a href="${verifyLink}" style="display:inline-block;background:#ff5500;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:7px;">Подтвердить почту</a></p>
      <p style="color:#767676;font-size:13px;">Ссылка действует 24 часа. До подтверждения почты онлайн-оплата недоступна. Если это были не вы — не открывайте ссылку.</p>
    </div>`,
  };
}

export async function notifyCustomerEmailVerification(
  customerId: string,
  welcome = false,
): Promise<void> {
  const customer = findCustomer(customerId);
  if (!customer) throw new Error(`Клиент ${customerId} не найден.`);
  if (customer.emailVerifiedAt) return;
  const token = makeEmailVerificationToken(customer.id);
  if (!token) throw new Error("Не удалось создать ссылку подтверждения почты.");
  const verifyLink = `${SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const result = await sendMailWithRetry(emailVerificationLetter({
    name: customer.name,
    email: customer.email,
    verifyLink,
    welcome,
  }));
  if (!result.ok) throw new Error(result.error);
}

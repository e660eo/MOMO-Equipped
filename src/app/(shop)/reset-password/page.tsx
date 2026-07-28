import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Смена пароля",
  robots: { index: false, follow: false },
};

/*
  Страница по ссылке из письма. Токен приходит в адресе; проверяет и меняет
  пароль серверное действие resetPassword — здесь только форма.
*/
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="mx-auto max-w-[420px] px-6 py-16">
      <h1 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold uppercase leading-tight">
        Новый пароль
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Задайте новый пароль для входа в личный кабинет.
      </p>
      <ResetPasswordForm token={token} />
    </main>
  );
}

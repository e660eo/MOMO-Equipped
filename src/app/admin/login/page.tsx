import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  hasSession,
  isConfigured,
  verifyAdminLogin,
  startSession,
  canAttempt,
  recordFailure,
  clearAttempts,
} from "@/lib/admin-auth";

/*
  Вход в панель.

  Форма отправляется серверным действием: пароль не попадает ни в адресную
  строку, ни в клиентский код. Ошибка возвращается через ?error=, чтобы
  страница осталась серверной и без лишнего состояния.
*/

async function login(formData: FormData) {
  "use server";

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (!canAttempt(ip)) {
    redirect("/admin/login?error=too-many");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminLogin(email, password)) {
    recordFailure(ip);
    redirect("/admin/login?error=wrong");
  }

  clearAttempts(ip);
  await startSession();
  redirect("/admin");
}

const MESSAGES: Record<string, string> = {
  wrong: "Неверный пароль.",
  "too-many": "Слишком много попыток. Подождите десять минут.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasSession()) redirect("/admin");

  const { error } = await searchParams;
  const configured = isConfigured();

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 py-16">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        MOMO Equipped
      </p>
      <h1 className="mt-3 font-display text-2xl font-extrabold uppercase leading-tight">
        Панель управления
      </h1>

      {configured ? (
        <form action={login} className="mt-8">
          <label className="block text-[0.8rem] font-medium" htmlFor="email">
            Почта
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="mt-2 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
          />

          <label
            className="mt-5 block text-[0.8rem] font-medium"
            htmlFor="password"
          >
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
          />
          {error && (
            <p className="mt-3 text-[0.82rem] text-[var(--signal-text)]">
              {MESSAGES[error] ?? "Не удалось войти."}
            </p>
          )}
          <button
            type="submit"
            className="mt-5 w-full rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
          >
            Войти
          </button>
        </form>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-surface p-5 text-[0.88rem] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Панель ещё не настроена</p>
          <p className="mt-2">
            На сервере не заданы <code>ADMIN_PASSWORD_HASH</code> и{" "}
            <code>ADMIN_SESSION_SECRET</code>. Задайте пароль командой{" "}
            <code>node scripts/admin-password.mjs</code> и вставьте полученные
            строки в файл <code>.env.local</code> — подробности в DEPLOY.md.
          </p>
        </div>
      )}
    </div>
  );
}

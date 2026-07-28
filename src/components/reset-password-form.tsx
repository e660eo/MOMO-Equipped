"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/app/customer-actions";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-base text-foreground transition-colors focus:border-signal focus:outline-none sm:text-sm";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      setError("Пароль — от шести символов.");
      return;
    }
    if (pw !== pw2) {
      setError("Пароли не совпадают.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await resetPassword(token, pw);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      // Сессия выдана сервером — обновляем разметку и уводим в кабинет.
      router.refresh();
      setTimeout(() => router.push("/profile"), 1400);
    } else {
      setError(res.error ?? "Не получилось изменить пароль.");
    }
  }

  if (!token) {
    return (
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Ссылка неполная. Запросите смену пароля заново — на странице входа
        нажмите «Забыли пароль?».
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-6 rounded-sm border border-border bg-surface px-4 py-3 text-sm">
        Пароль изменён, вы вошли. Открываем кабинет…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3.5">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Новый пароль"
          className={cn(inputCls, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-signal"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <input
        type={show ? "text" : "password"}
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        required
        autoComplete="new-password"
        placeholder="Повторите пароль"
        className={inputCls}
      />
      {error && (
        <p role="alert" className="text-sm text-signal">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
      >
        {busy ? "Сохраняем…" : "Сохранить пароль"}
      </button>
    </form>
  );
}

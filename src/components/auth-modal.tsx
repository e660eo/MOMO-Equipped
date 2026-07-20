"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneInput } from "./phone-input";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

export function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [regPhone, setRegPhone] = useState("");

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Личный кабинет"
        className={cn(
          "fixed inset-0 z-[100] m-auto h-fit max-h-[90vh] w-[min(440px,calc(100vw-32px))] overflow-auto rounded-md border border-border bg-surface p-8 shadow-xl transition-all",
          open ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          <X size={15} />
        </button>

        <h3 className="font-display text-lg font-semibold uppercase">
          Личный кабинет
        </h3>

        <div className="my-5 flex gap-1 rounded-full border border-border p-1">
          {(
            [
              ["login", "Вход"],
              ["register", "Регистрация"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
                tab === key
                  ? "bg-signal text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "login" ? (
          <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className={labelCls} htmlFor="lg-contact">
                Телефон или email
              </label>
              <input
                id="lg-contact"
                type="text"
                autoComplete="username"
                placeholder="+7 ___ ___-__-__"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lg-pass">
                Пароль
              </label>
              <input
                id="lg-pass"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Войти
            </button>
          </form>
        ) : (
          <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className={labelCls} htmlFor="rg-name">
                Имя
              </label>
              <input
                id="rg-name"
                type="text"
                autoComplete="name"
                placeholder="Как к вам обращаться"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-phone">
                Телефон
              </label>
              <PhoneInput
                id="rg-phone"
                value={regPhone}
                onChange={setRegPhone}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-email">
                Email
              </label>
              <input
                id="rg-email"
                type="email"
                autoComplete="email"
                placeholder="you@mail.ru"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-pass">
                Пароль
              </label>
              <input
                id="rg-pass"
                type="password"
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Создать аккаунт
            </button>
          </form>
        )}

        <p className="mt-4 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
          Аккаунты включаются в Фазе 3: история заказов и сохранённые данные
          получателя.
        </p>
      </div>
    </>
  );
}

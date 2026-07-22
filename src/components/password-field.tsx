"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Поле пароля с показом введённого.
 *
 * Менеджер паролей подставляет в форму сохранённую пару молча, и человек не
 * понимает, почему верный пароль «не подходит», — увидеть содержимое поля
 * оказывается быстрее любых объяснений.
 */
export function PasswordField({
  id = "password",
  name = "password",
  className,
  autoFocus,
}: {
  id?: string;
  name?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete="current-password"
        autoFocus={autoFocus}
        required
        className={cn(
          "w-full rounded-sm border border-input bg-surface px-3 py-2.5 pr-11 text-sm focus:border-signal focus:outline-none",
          className,
        )}
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
  );
}

"use client";

import { useState, useTransition } from "react";
import { issueTempPassword } from "@/app/admin/customers/actions";

/**
 * Выдача временного пароля покупателю.
 *
 * Показываем результат прямо в строке и не прячем до перезагрузки: пароль
 * виден один раз, второй раз его взять неоткуда — только сбросить заново.
 */
export function ResetPasswordButton({
  customerId,
  name,
}: {
  customerId: string;
  name: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (password) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <code className="select-all rounded-sm border border-signal px-2 py-0.5 font-mono text-[0.8rem] text-signal">
          {password}
        </code>
        <span className="text-[0.68rem] text-muted-foreground">
          продиктуйте покупателю — больше не покажем
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Выдать новый временный пароль для «${name}»? Прежний перестанет работать.`,
            )
          ) {
            return;
          }
          start(async () => {
            const result = await issueTempPassword(customerId);
            if (result.ok) setPassword(result.password);
            else setError(result.error);
          });
        }}
        className="whitespace-nowrap text-[0.8rem] text-muted-foreground transition-all hover:text-signal active:scale-95 disabled:opacity-60"
      >
        {pending ? "Меняю…" : "Сбросить пароль"}
      </button>
      {error && (
        <span className="text-[0.68rem] text-[var(--signal-text)]">{error}</span>
      )}
    </span>
  );
}

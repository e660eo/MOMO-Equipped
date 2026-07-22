"use client";

import { cn } from "@/lib/utils";

/**
 * Кнопка действия с подтверждением. Нужна там, где отменить нельзя
 * (удалённый товар возвращается только из резервной копии данных) или где
 * действие тянет за собой чужие изменения — например, убирает позицию
 * из готовых сборок.
 */
export function ConfirmButton({
  label,
  question,
  tone = "danger",
}: {
  label: string;
  question: string;
  tone?: "danger" | "neutral";
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
      className={cn(
        "text-muted-foreground transition-colors",
        tone === "danger"
          ? "hover:text-[var(--signal-text)]"
          : "hover:text-signal",
      )}
    >
      {label}
    </button>
  );
}

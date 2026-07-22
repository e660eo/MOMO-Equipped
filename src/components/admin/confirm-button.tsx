"use client";

/**
 * Кнопка необратимого действия. Спрашивает подтверждение перед отправкой
 * формы — удалённый товар не вернуть иначе как из резервной копии данных.
 */
export function ConfirmButton({
  label,
  question,
}: {
  label: string;
  question: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
      className="text-muted-foreground transition-colors hover:text-[var(--signal-text)]"
    >
      {label}
    </button>
  );
}

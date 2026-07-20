import Link from "next/link";

/*
  Согласие на обработку ПД (152-ФЗ) — под каждой формой, которая собирает
  ФИО, телефон, адрес или email.

  Два режима:
  • без props — неуправляемый, с нативным required: браузер сам не даст
    отправить <form>. Так работает форма на контактах (серверный компонент).
  • с checked/onChange — управляемый: submit проверяется в коде. Так работает
    корзина, где отправка идёт по onClick, а не сабмитом формы.

  Атрибут name намеренно не задан: у формы контактов method="get", и чекбокс
  с именем уехал бы лишним параметром в ссылку WhatsApp.
*/
export function ConsentCheckbox({
  id,
  checked,
  onChange,
  className = "",
}: {
  id: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  className?: string;
}) {
  const controlled = onChange !== undefined;

  /*
    Ссылка намеренно вынесена из <label>: если её обернуть, клик по «политике»
    открывал бы документ и заодно ставил галочку — согласие проставлялось бы
    случайно. Здесь <label> покрывает только текст, ссылка — его сосед, и оба
    остаются строчными, поэтому фраза переносится единым абзацем.
  */
  return (
    <div
      className={`flex items-start gap-2.5 text-[0.78rem] leading-relaxed text-muted-foreground ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        {...(controlled
          ? { checked, onChange: (e) => onChange(e.target.checked) }
          : { required: true })}
        className="mt-[0.15rem] h-[0.95rem] w-[0.95rem] shrink-0 cursor-pointer accent-[#FF5500]"
      />
      <span>
        <label htmlFor={id} className="cursor-pointer">
          Согласен на обработку персональных данных и принимаю{" "}
        </label>
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener"
          className="text-[var(--signal-text)] underline underline-offset-2 transition-colors hover:no-underline"
        >
          политику конфиденциальности
        </Link>
      </span>
    </div>
  );
}

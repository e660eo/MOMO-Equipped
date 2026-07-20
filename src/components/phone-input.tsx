"use client";

import { formatPhone } from "@/lib/phone";

/**
 * Поле телефона с маской +7 999 123-45-67.
 *
 * Значение хранится уже отформатированным — так его видно и в состоянии
 * формы, и при отправке заказа. Каретка не «прыгает», потому что при вводе
 * пользователь дописывает в конец; при правке середины строка просто
 * переформатируется целиком.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  className,
  placeholder = "+7 ___ ___-__-__",
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required={required}
      placeholder={placeholder}
      className={className}
      value={value}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      onFocus={(e) => {
        // Подставляем префикс, чтобы человек начинал сразу с кода оператора
        if (!e.target.value) onChange("+7 ");
      }}
    />
  );
}

import type { ReactNode } from "react";

/**
 * Семантическая обёртка секции. Контент сразу виден в серверном HTML: это
 * дешевле клиентской scroll-анимации и надёжнее для SEO и скриншотов.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  void delay;
  return <div className={className}>{children}</div>;
}

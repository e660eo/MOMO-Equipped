"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { formatPrice, splitPayment } from "@/lib/format";

/*
  График оплаты частями: четыре доли, заливающиеся по очереди.

  Показывается только на широких экранах (`hidden lg:block` на месте вызова):
  четыре подписи под шкалой на 375 px сжимаются в нечитаемые столбики, а
  условия сплита покупатель с телефона всё равно видит текстом в корзине и
  на странице доставки.

  Анимацию запускает попадание в область просмотра, а не наведение мыши.
  В исходном наброске это был hover — но тогда всё, что видит человек,
  просто пролиставший страницу, это четыре пустых серых отрезка: читается
  как поломка, а не как сдержанность. Приём тот же, что в `Reveal`, —
  `whileInView` с однократным показом.
*/

interface Step {
  /** Когда платёж: подпись под отрезком. */
  label: string;
  /** Накопленная доля к этому платежу. */
  share: string;
}

/*
  График повторяет то, что уже написано на странице доставки: четверть суммы
  раз в две недели. Отдельного источника у этих сроков нет — они пришли из
  условий сплита, и при заключении договора их нужно сверить с настоящими.
*/
const STEPS: Step[] = [
  { label: "Сегодня", share: "25%" },
  { label: "2 недели", share: "50%" },
  { label: "4 недели", share: "75%" },
  { label: "6 недель", share: "100%" },
];

/** Пауза между соседними отрезками, секунды. */
const STAGGER = 0.14;

const row: Variants = {
  rest: {},
  shown: { transition: { staggerChildren: STAGGER } },
};

const bar: Variants = {
  rest: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const caption: Variants = {
  rest: { opacity: 0.35, y: 4 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function SplitProgress({
  /** Цена, от которой считать платёж. Без неё показываем только доли. */
  price,
  className,
}: {
  price?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      /*
        Состояния наследуются вложенными motion-элементами, поэтому
        достаточно объявить их здесь. При отключённых анимациях карточка
        сразу рисуется в конечном виде: она остаётся понятной, просто без
        движения.
      */
      initial={reduce ? "shown" : "rest"}
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      className={`rounded-xl border border-border bg-surface p-6 transition-colors duration-300 hover:border-signal/50 ${className ?? ""}`}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold">
            Оплата частями
          </h3>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            Четыре платежа, без процентов
          </p>
        </div>
        {price !== undefined && (
          <p className="text-right">
            <span className="font-display text-lg font-extrabold text-[var(--signal-text)]">
              {formatPrice(splitPayment(price))}
            </span>
            <span className="block font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              каждые две недели
            </span>
          </p>
        )}
      </div>

      {/* Шкала: четыре отрезка, заливаются слева направо */}
      <motion.div variants={row} className="mt-6 flex h-1.5 gap-2">
        {STEPS.map((step) => (
          <div
            key={step.label}
            className="relative flex-1 overflow-hidden rounded-full bg-border"
          >
            <motion.span
              aria-hidden
              variants={bar}
              /*
                Анимируем transform, а не width: ширина заставляет браузер
                пересчитывать раскладку на каждом кадре, трансформация — нет.
                origin-left, иначе отрезок растёт из середины в обе стороны.
              */
              className="absolute inset-0 origin-left rounded-full bg-signal"
            />
          </div>
        ))}
      </motion.div>

      {/* Подписи: доля и срок под своим отрезком */}
      <motion.div variants={row} className="mt-3 flex gap-2">
        {STEPS.map((step) => (
          <motion.div
            key={step.label}
            variants={caption}
            className="flex-1 text-center"
          >
            <span className="block font-mono text-[0.7rem] font-semibold tabular-nums text-foreground">
              {step.share}
            </span>
            <span className="mt-0.5 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              {step.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

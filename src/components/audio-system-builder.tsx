"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Gauge,
  Music2,
  Plus,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  Waves,
} from "lucide-react";
import {
  buildAudioRecommendation,
  type AudioBuilderProduct,
  type AudioGoal,
  type SpeakerSize,
} from "@/lib/audio-builder";
import { useCart } from "@/lib/cart-store";
import { formatPrice, productImageUrl } from "@/lib/format";
import { METRIKA_GOALS, reachMetrikaGoal } from "@/lib/metrika";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

const goals: Array<{
  value: AudioGoal;
  title: string;
  text: string;
  icon: typeof Music2;
}> = [
  {
    value: "balanced",
    title: "Чисто и детально",
    text: "Ровный тональный баланс и комфортная громкость на каждый день.",
    icon: Music2,
  },
  {
    value: "loud",
    title: "Громкий фронт",
    text: "Напор, чувствительность и запас громкости для открытых дверей.",
    icon: Volume2,
  },
  {
    value: "bass",
    title: "Больше баса",
    text: "Низкие частоты — главный приоритет, фронт поддерживает систему.",
    icon: Waves,
  },
];

const sizes: Array<{ value: SpeakerSize; title: string; text: string }> = [
  { value: "130", title: "13 см", text: "130 мм" },
  { value: "165", title: "16 см", text: "165 мм" },
  { value: "200", title: "20 см", text: "200–210 мм" },
  { value: "unknown", title: "Не знаю", text: "Проверим перед установкой" },
];

const quickBudgets = [10_000, 20_000, 35_000, 60_000];

function OptionButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group relative min-h-11 rounded-xl border p-4 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[.99]",
        selected
          ? "border-signal bg-signal/[0.07] shadow-[0_12px_32px_-24px_rgba(255,85,0,.8)]"
          : "border-border bg-bg hover:border-signal/50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
          selected ? "border-signal bg-signal text-white" : "border-border text-transparent",
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      {children}
    </button>
  );
}

function StepProgress({ step }: { step: number }) {
  const labels = ["Характер", "Размер", "Бюджет"];
  return (
    <ol aria-label="Этапы подбора" className="grid grid-cols-3 gap-2">
      {labels.map((label, index) => {
        const number = index + 1;
        const complete = step > number;
        const current = step === number;
        return (
          <li key={label} aria-current={current ? "step" : undefined}>
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                current || complete ? "bg-signal" : "bg-border",
              )}
            />
            <span
              className={cn(
                "mt-2 block font-mono text-[0.6rem] uppercase tracking-[0.12em]",
                current || complete ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {number}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SignalChain({ labels }: { labels: string[] }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] px-4 py-5">
      <div aria-hidden className="absolute left-8 right-8 top-[2.15rem] h-px bg-gradient-to-r from-signal via-amber-300 to-signal" />
      <ol className="relative grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(labels.length, 4)}, minmax(0, 1fr))` }}>
        {labels.slice(0, 4).map((label, index) => (
          <li key={`${label}-${index}`} className="min-w-0 text-center">
            <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-signal/60 bg-[#141416] text-signal shadow-[0_0_18px_rgba(255,85,0,.25)]">
              <CircleDot size={11} />
            </span>
            <span className="mt-2 block truncate font-mono text-[0.58rem] uppercase tracking-[0.08em] text-white/65">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AudioSystemBuilder({
  products,
  whatsapp,
}: {
  products: AudioBuilderProduct[];
  whatsapp: string;
}) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<AudioGoal | null>(null);
  const [size, setSize] = useState<SpeakerSize | null>(null);
  const [budget, setBudget] = useState(20_000);
  const contentRef = useRef<HTMLDivElement>(null);
  const addMany = useCart((state) => state.addMany);

  const recommendation = useMemo(
    () =>
      goal && size
        ? buildAudioRecommendation(products, { goal, size, budget })
        : null,
    [budget, goal, products, size],
  );

  useEffect(() => {
    if (step > 1) contentRef.current?.focus();
  }, [step]);

  const finish = () => {
    if (!goal || !size) return;
    setStep(4);
    reachMetrikaGoal(METRIKA_GOALS.systemBuilderComplete, {
      goal,
      size,
      budget,
    });
  };

  const addSystem = () => {
    if (!recommendation || !goal) return;
    addMany(
      recommendation.items.map(({ product }) => ({
        slug: product.slug,
        title: product.title,
        price: product.price,
        image: product.image,
        stock: product.stock,
      })),
      {
        title: "Система добавлена",
        description: `${recommendation.title} — ${recommendation.items.length} позиций`,
      },
    );
    reachMetrikaGoal(METRIKA_GOALS.systemBuilderAdd, {
      goal,
      size: recommendation.assumedSize,
      budget,
      total: recommendation.total,
      items: recommendation.items.length,
    });
  };

  const message = recommendation
    ? `Здравствуйте! Хочу проверить систему «${recommendation.title}» на совместимость с моим автомобилем. Бюджет ${formatPrice(budget)}.`
    : "Здравствуйте! Помогите собрать аудиосистему для автомобиля.";
  const whatsappHref = `${whatsapp}${whatsapp.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:items-start">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_55px_-38px_rgba(0,0,0,.45)] sm:p-7">
        <StepProgress step={Math.min(step, 3)} />

        <div ref={contentRef} tabIndex={-1} className="mt-8 outline-none">
          {step === 1 && (
            <fieldset>
              <legend className="font-display text-xl font-extrabold uppercase sm:text-2xl">
                Как должен <span className="text-signal">звучать</span> автомобиль?
              </legend>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Выберите главное. Остальные компоненты мастер подстроит под эту задачу.
              </p>
              <div className="mt-6 grid gap-3">
                {goals.map((option) => {
                  const Icon = option.icon;
                  return (
                    <OptionButton
                      key={option.value}
                      selected={goal === option.value}
                      onClick={() => setGoal(option.value)}
                    >
                      <span className="flex items-start gap-3 pr-7">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-signal">
                          <Icon size={19} />
                        </span>
                        <span>
                          <span className="block font-display text-base font-bold uppercase">{option.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-sm">{option.text}</span>
                        </span>
                      </span>
                    </OptionButton>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!goal}
                onClick={() => setStep(2)}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Дальше <ArrowRight size={16} />
              </button>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend className="font-display text-xl font-extrabold uppercase sm:text-2xl">
                Какой размер <span className="text-signal">фронта</span>?
              </legend>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Речь о штатном посадочном месте в передних дверях. Если сомневаетесь — так и отметьте.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {sizes.map((option) => (
                  <OptionButton
                    key={option.value}
                    selected={size === option.value}
                    onClick={() => setSize(option.value)}
                    className="min-h-[104px]"
                  >
                    <span className="block font-display text-lg font-bold uppercase">{option.title}</span>
                    <span className="mt-2 block pr-3 text-xs leading-relaxed text-muted-foreground">{option.text}</span>
                  </OptionButton>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
                >
                  <ArrowLeft size={16} /> <span className="sr-only sm:not-sr-only">Назад</span>
                </button>
                <button
                  type="button"
                  disabled={!size}
                  onClick={() => setStep(3)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-signal px-6 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Дальше <ArrowRight size={16} />
                </button>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend className="font-display text-xl font-extrabold uppercase sm:text-2xl">
                Бюджет на <span className="text-signal">оборудование</span>
              </legend>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Стоимость установки и изготовления короба не входит — они зависят от автомобиля.
              </p>
              <div className="mt-7 rounded-xl border border-border bg-bg p-5">
                <div className="flex items-end justify-between gap-3">
                  <label htmlFor="system-budget" className="text-sm font-medium">До какой суммы</label>
                  <output htmlFor="system-budget" className="font-display text-2xl font-extrabold text-signal">
                    {formatPrice(budget)}
                  </output>
                </div>
                <input
                  id="system-budget"
                  type="range"
                  min={8_000}
                  max={70_000}
                  step={1_000}
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                  className="mt-5 h-11 w-full cursor-pointer accent-[var(--signal)]"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {quickBudgets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={budget === value}
                      onClick={() => setBudget(value)}
                      className={cn(
                        "min-h-11 rounded-lg border px-2 font-mono text-xs transition-colors",
                        budget === value
                          ? "border-signal bg-signal/10 text-[var(--signal-text)]"
                          : "border-border hover:border-signal/50",
                      )}
                    >
                      {formatPrice(value)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-signal" />
                Если точная система не помещается, покажем ближайший рабочий вариант и разницу в цене.
              </div>
              <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
                >
                  <ArrowLeft size={16} /> <span className="sr-only sm:not-sr-only">Назад</span>
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-signal px-6 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,.35)]"
                >
                  Собрать систему <SlidersHorizontal size={16} />
                </button>
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <div>
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-signal">Подбор готов</p>
              <h2 className="mt-2 font-display text-xl font-extrabold uppercase sm:text-2xl">
                {recommendation?.title ?? "Нужна ручная проверка"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {recommendation?.summary ?? "Сейчас в каталоге нет полной готовой комбинации под выбранные параметры. Менеджер соберёт её вручную."}
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--signal-text)] hover:underline"
              >
                <ArrowLeft size={15} /> Изменить параметры
              </button>
            </div>
          )}
        </div>
      </section>

      <aside aria-live="polite" className="overflow-hidden rounded-2xl border border-white/10 text-[#f5f3ef] shadow-[0_28px_70px_-40px_rgba(0,0,0,.9)] [background:radial-gradient(100%_100%_at_100%_0%,rgba(255,85,0,.18),transparent_58%),linear-gradient(145deg,#0d0d0f,#1b1b1f)] lg:sticky lg:top-[92px]">
        <div className="border-b border-white/10 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/55">Сигнальная цепь</span>
            <Radio size={18} className="text-signal" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold uppercase leading-tight sm:text-3xl">
            {step === 4 && recommendation ? recommendation.title : "Ваша система появится здесь"}
          </h2>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/55">
            {step === 4 && recommendation
              ? "Каждое звено — реальный товар из каталога. Нажмите на модель, чтобы открыть характеристики."
              : "Ответьте на три вопроса — мастер выстроит путь от источника сигнала до фронта и баса."}
          </p>
          <SignalChain
            labels={
              step === 4 && recommendation
                ? recommendation.items.map((item) => item.role)
                : ["Источник", "Усиление", "Акустика", "Бас"]
            }
          />
        </div>

        {step === 4 && recommendation ? (
          <div className="p-4 sm:p-6">
            {recommendation.needsSizeCheck && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-50/80">
                <Gauge size={16} className="mt-0.5 shrink-0 text-amber-300" />
                За основу взят распространённый размер 16 см. Перед покупкой подтвердите посадочное место автомобиля.
              </div>
            )}
            <ul className="divide-y divide-white/10">
              {recommendation.items.map(({ role, product }) => (
                <li key={`${role}-${product.slug}`}>
                  <Link href={`/product/${product.slug}`} className="group flex min-h-[74px] items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                      <ProductImage
                        src={productImageUrl(product.image)}
                        alt=""
                        sizes="112px"
                        className="h-[88%] w-[88%] object-contain"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[0.56rem] uppercase tracking-[0.12em] text-signal">{role}</span>
                      <span className="mt-1 block text-sm font-semibold leading-snug text-white/90 transition-colors group-hover:text-signal">{product.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-white/60">{formatPrice(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/45">Оборудование</p>
                  <p className="mt-1 font-display text-3xl font-extrabold">{formatPrice(recommendation.total)}</p>
                </div>
                <p className={cn("max-w-[170px] text-right text-xs leading-relaxed", recommendation.isOverBudget ? "text-amber-300" : "text-emerald-300")}>
                  {recommendation.isOverBudget
                    ? `Выше бюджета на ${formatPrice(recommendation.difference)}`
                    : `Остаётся ${formatPrice(recommendation.difference)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={addSystem}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-signal px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] hover:shadow-[0_6px_28px_rgba(255,85,0,.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Plus size={16} strokeWidth={2.6} /> Добавить всё в корзину
              </button>
              <a
                href={whatsappHref}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/15 px-6 py-3 text-center text-sm font-semibold text-white/80 transition-colors hover:border-signal hover:text-white"
              >
                Проверить под мой автомобиль
              </a>
            </div>
          </div>
        ) : step === 4 ? (
          <div className="p-6">
            <a href={whatsappHref} className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-signal px-6 text-sm font-semibold text-white">
              Собрать с менеджером
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
            {["Реальные цены", "Товары в наличии", "Без лишних деталей"].map((item) => (
              <div key={item} className="px-2 py-5 text-center font-mono text-[0.56rem] uppercase tracking-[0.08em] text-white/45 sm:px-4">
                {item}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}


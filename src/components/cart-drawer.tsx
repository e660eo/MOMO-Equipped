"use client";

import { useEffect, useState } from "react";
import { X, Minus, Plus, Trash2, Truck } from "lucide-react";
import { useCart, cartTotal } from "@/lib/cart-store";
import { formatPrice, splitPayment, productImageUrl, siteConfig } from "@/lib/data";
import { isPhoneComplete } from "@/lib/phone";
import { ProductImage } from "./product-image";
import { PhoneInput } from "./phone-input";
import { cn } from "@/lib/utils";

// Данные получателя запоминаем — при повторном заказе не вводить заново.
const RECIPIENT_KEY = "momo-recipient";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

export function CartDrawer() {
  const { items, isOpen, closeCart, setQty, remove, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Подставляем сохранённые данные получателя при первом открытии
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECIPIENT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.name) setName(d.name);
      if (d.phone) setPhone(d.phone);
      if (d.address) setAddress(d.address);
    } catch {}
  }, []);

  const total = cartTotal(items);
  // Апсейл: сколько не хватает до бесплатной доставки.
  const freeFrom = siteConfig.trust.freeShippingFrom;
  const remaining = Math.max(0, freeFrom - total);
  const shippingPct = Math.min(100, (total / freeFrom) * 100);

  function submit() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Заполните ФИО, телефон и адрес доставки.");
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError("Проверьте телефон — в номере должно быть 10 цифр после +7.");
      return;
    }
    setError("");

    // Запоминаем получателя для следующего заказа
    try {
      localStorage.setItem(
        RECIPIENT_KEY,
        JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
      );
    } catch {}
    const lines = [
      "Заказ с сайта MOMO:",
      ...items.map(
        (i) => `• ${i.title} — ${i.qty} шт. × ${formatPrice(i.price)}`,
      ),
      `Итого: ${formatPrice(total)}`,
      "",
      `Получатель: ${name.trim()}`,
      `Телефон: ${phone.trim()}`,
      `Адрес: ${address.trim()}`,
      comment.trim() ? `Комментарий: ${comment.trim()}` : "",
    ].filter(Boolean);
    const url = `${siteConfig.contacts.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
    setSent(true);
    clear();
  }

  return (
    <>
      <div
        onClick={closeCart}
        className={cn(
          "fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        className={cn(
          "fixed bottom-0 right-0 top-0 z-[100] w-[min(460px,100vw)] overflow-y-auto border-l border-border bg-surface p-7 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <button
          onClick={closeCart}
          aria-label="Закрыть корзину"
          className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          <X size={15} />
        </button>

        <h3 className="mb-6 font-display text-lg font-semibold uppercase">
          Корзина
        </h3>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Заказ сформирован и открыт в WhatsApp — отправьте сообщение, и
              менеджер подтвердит заказ в течение рабочего дня.
            </p>
            <button
              onClick={() => {
                setSent(false);
                closeCart();
              }}
              className="w-full rounded-sm border border-border py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Вернуться к покупкам
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              В корзине пока пусто. Добавьте товары из каталога — они появятся
              здесь.
            </p>
            <a
              href="/catalog"
              onClick={closeCart}
              className="inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Открыть каталог
            </a>
          </div>
        ) : (
          <>
            <ul>
              {items.map((i) => (
                <li
                  key={i.slug}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3.5 border-b border-border py-3.5"
                >
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-sm border border-border bg-tile">
                    <ProductImage
                      src={productImageUrl(i.image)}
                      alt=""
                      className="h-[85%] w-[85%] object-contain mix-blend-multiply"
                    />
                  </span>
                  <span>
                    <span className="block text-[0.84rem] font-medium leading-snug">
                      {i.title}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-2">
                      <button
                        aria-label="Убавить"
                        onClick={() => setQty(i.slug, i.qty - 1)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-mono text-xs">{i.qty}</span>
                      <button
                        aria-label="Прибавить"
                        onClick={() => setQty(i.slug, i.qty + 1)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Plus size={11} />
                      </button>
                      <button
                        aria-label="Удалить из корзины"
                        onClick={() => remove(i.slug)}
                        className="ml-1 text-muted-foreground transition-colors hover:text-signal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </span>
                  <span className="font-display text-sm font-semibold">
                    {formatPrice(i.price * i.qty)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Прогресс до бесплатной доставки */}
            <div className="mt-5 rounded-xl border border-border bg-bg p-4">
              {remaining > 0 ? (
                <p className="text-[0.82rem]">
                  До бесплатной доставки{" "}
                  <b className="font-semibold text-[var(--signal-text)]">
                    {formatPrice(remaining)}
                  </b>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-[0.82rem] font-semibold text-[var(--signal-text)]">
                  <Truck size={15} />
                  Доставка бесплатно
                </p>
              )}
              <div
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={Math.round(shippingPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Прогресс до бесплатной доставки"
              >
                <div
                  className="h-full rounded-full bg-signal transition-[width] duration-500"
                  style={{ width: `${shippingPct}%` }}
                />
              </div>
            </div>

            <p className="mb-4 mt-6 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
              Данные получателя
            </p>
            <div className="space-y-3.5">
              <div>
                <label className={labelCls} htmlFor="rc-name">
                  ФИО
                </label>
                <input
                  id="rc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Фамилия Имя Отчество"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-phone">
                  Телефон
                </label>
                <PhoneInput
                  id="rc-phone"
                  value={phone}
                  onChange={setPhone}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-addr">
                  Адрес доставки
                </label>
                <textarea
                  id="rc-addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  autoComplete="street-address"
                  placeholder="Город, улица, дом, квартира"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-comment">
                  Комментарий к заказу
                </label>
                <textarea
                  id="rc-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Необязательно"
                  className={inputCls}
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-signal" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-baseline justify-between">
              <span className="text-sm">Итого</span>
              <span className="font-display text-xl font-extrabold">
                {formatPrice(total)}
              </span>
            </div>
            <p className="mb-3 mt-1 font-mono text-[0.7rem] text-muted-foreground">
              или сплит{" "}
              <b className="font-medium text-[var(--signal-text)]">
                {formatPrice(splitPayment(total))} × 4
              </b>{" "}
              без процентов
            </p>
            <button
              onClick={submit}
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Оформить через WhatsApp
            </button>
            <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
              Заказ уйдёт менеджеру в WhatsApp. Онлайн-оплата (ЮKassa)
              подключается в Фазе 3.
            </p>
          </>
        )}
      </aside>
    </>
  );
}

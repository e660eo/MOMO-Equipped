"use client";

import { useEffect, useState } from "react";
import { X, Minus, Plus, Trash2, Truck, MapPin, LocateFixed } from "lucide-react";
import { useCart, cartTotal } from "@/lib/cart-store";
import { formatPrice, productImageUrl } from "@/lib/format";
import { useSiteConfig } from "@/components/site-config-provider";
import { useCustomer } from "@/components/customer-provider";
import { useAccount } from "@/lib/account-store";
import { isPhoneComplete } from "@/lib/phone";
import {
  submitOrder,
  checkPromo,
  searchOzonPickupPoints,
  selectOzonPickup,
} from "@/app/order-actions";
import type {
  OzonDeliverySelection,
  PublicOzonPoint,
} from "@/lib/ozon-delivery";
import { ProductImage } from "./product-image";
import { PhoneInput } from "./phone-input";
import { ConsentCheckbox } from "./consent-checkbox";
import { cn } from "@/lib/utils";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { YandexSplitBadge } from "./yandex-split-badge";

// Данные получателя запоминаем — при повторном заказе не вводить заново.
const RECIPIENT_KEY = "momo-recipient";

// text-base на узком экране: при шрифте меньше 16px Safari на iPhone
// приближает страницу, как только человек ставит курсор в поле, и обратно
// уже не отдаляет. См. тот же комментарий в catalog-view.tsx.
const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-base text-foreground transition-colors focus:border-signal focus:outline-none sm:text-sm";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

export function CartDrawer() {
  const { items, isOpen, closeCart, setQty, remove, clear } = useCart();
  const customer = useCustomer();
  const openAuth = useAccount((s) => s.openModal);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [sending, setSending] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(
    null,
  );
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [points, setPoints] = useState<PublicOzonPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PublicOzonPoint | null>(null);
  const [delivery, setDelivery] = useState<OzonDeliverySelection | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState("");

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

  /*
    Корзина грузится отдельным куском, и в редком случае — если по ней успели
    нажать раньше, чем кусок доехал, — она смонтируется уже открытой и просто
    возникнет на экране без выезда. Первый кадр всегда рисуем закрытым, а
    открываем со следующего: переход получает от чего оттолкнуться.
  */
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = isOpen && entered;

  // Фон под корзиной не должен прокручиваться — раньше он уезжал вместе с ней
  useEffect(() => {
    if (!shown) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [shown, closeCart]);

  const { contacts, trust, payEnabled, paySandbox } = useSiteConfig();
  const total = cartTotal(items);
  const freeFrom = trust.freeShippingFrom;

  // Скидка по промокоду. Процент подтверждает сервер (checkPromo), но настоящую
  // проверку и списание делает submitOrder — здесь только показ.
  const discount = promo ? Math.round((total * promo.percent) / 100) : 0;
  const payable = total - discount;
  // Бесплатная онлайн-доставка считается от суммы, которую реально заплатят.
  const remaining = Math.max(0, freeFrom - payable);
  const shippingPct = Math.min(100, (payable / freeFrom) * 100);
  const onlineDeliveryAvailable = payable >= freeFrom;

  useEffect(() => {
    setDelivery(null);
  }, [phone, items]);

  async function locatePickupPoints() {
    if (!("geolocation" in navigator)) {
      setDeliveryMsg("Браузер не умеет определять местоположение. Оформите через WhatsApp.");
      return;
    }
    setDeliveryBusy(true);
    setDeliveryMsg("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const result = await searchOzonPickupPoints({
          lat: coords.latitude,
          long: coords.longitude,
        });
        setDeliveryBusy(false);
        if (!result.ok) {
          setDeliveryMsg(result.error);
          return;
        }
        setPoints(result.points);
        setSelectedPoint(result.points[0] ?? null);
      },
      () => {
        setDeliveryBusy(false);
        setDeliveryMsg("Разрешите сайту доступ к геопозиции, чтобы показать ближайшие ПВЗ Ozon.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function confirmPickup() {
    if (!selectedPoint) return;
    if (!isPhoneComplete(phone)) {
      setDeliveryMsg("Сначала укажите полный номер телефона.");
      return;
    }
    setDeliveryBusy(true);
    setDeliveryMsg("");
    const result = await selectOzonPickup({
      phone,
      pointId: selectedPoint.id,
      items: items.map((item) => ({ slug: item.slug, qty: item.qty })),
    });
    setDeliveryBusy(false);
    if (!result.ok) {
      setDelivery(null);
      setDeliveryMsg(result.error);
      return;
    }
    setDelivery(result.delivery);
  }

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg("");
    const res = await checkPromo(code);
    setPromoBusy(false);
    if (res.ok) {
      setPromo({ code: res.code, percent: res.percent });
      setPromoInput(res.code);
    } else {
      setPromo(null);
      setPromoMsg(res.error);
    }
  }
  function removePromo() {
    setPromo(null);
    setPromoInput("");
    setPromoMsg("");
  }

  async function submit(pay = false) {
    if (pay && !onlineDeliveryAvailable) {
      setError(`Онлайн-доставка Ozon доступна от ${formatPrice(freeFrom)}.`);
      return;
    }
    if (pay && !customer) {
      setError("Для оплаты на сайте войдите или зарегистрируйтесь.");
      openAuth("checkout");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Заполните ФИО, телефон и адрес доставки.");
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError("Проверьте телефон — в номере должно быть 10 цифр после +7.");
      return;
    }
    if (pay && !delivery) {
      setError("Выберите и подтвердите пункт Ozon перед оплатой.");
      return;
    }
    // Согласие на обработку ПД не запоминаем — его дают заново на каждый заказ.
    if (!consent) {
      setError("Отметьте согласие на обработку персональных данных.");
      return;
    }
    setError("");
    setSending(true);

    /*
      Сначала сохраняем заказ на сервере. WhatsApp-заявка сразу появляется в
      панели; онлайн-запись остаётся скрытой до подтверждённой оплаты.

      Если обычную WhatsApp-заявку сохранить не удалось, состав всё равно
      откроется в переписке. Онлайн-платёж без серверной записи не начинаем.
    */
    const saved = await submitOrder({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      comment: comment.trim(),
      items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
      pay,
      ...(promo ? { promoCode: promo.code } : {}),
      ...(pay && delivery ? { deliveryToken: delivery.token } : {}),
    });
    setSending(false);
    const orderNumber = saved.ok ? saved.id : null;

    if (pay && !saved.ok) {
      setError(saved.error);
      if (saved.requiresAuth) openAuth("checkout");
      return;
    }

    /*
      Оплата на сайте: уводим на форму Яндекса тем же переходом, без нового
      окна — платёжную страницу браузеры и блокировщики любят придержать,
      а пропавшая оплата выглядит как поломка магазина.

      Локальную квитанцию тут не пишем: заказ уже на сервере, а в кабинете он
      появится с настоящим статусом оплаты.
    */
    if (pay && saved.ok && saved.paymentUrl) {
      // Запоминаем получателя до ухода со страницы
      try {
        localStorage.setItem(
          RECIPIENT_KEY,
          JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
        );
      } catch {}
      window.location.href = saved.paymentUrl;
      return;
    }

    // Просили оплату, а ссылки нет. Техническая заготовка скрыта от панели;
    // новую попытку начинаем заново, чтобы не переиспользовать старую сессию.
    if (pay) {
      setError(
        "Яндекс Pay не создал новую ссылку. Попробуйте ещё раз через минуту.",
      );
      return;
    }

    // Запоминаем получателя для следующего заказа
    try {
      localStorage.setItem(
        RECIPIENT_KEY,
        JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
      );
    } catch {}
    const lines = [
      orderNumber ? `Заказ №${orderNumber} с сайта MOMO:` : "Заказ с сайта MOMO:",
      ...items.map(
        (i) => `• ${i.title} — ${i.qty} шт. × ${formatPrice(i.price)}`,
      ),
      ...(promo
        ? [`Промокод ${promo.code}: −${promo.percent}% (−${formatPrice(discount)})`]
        : []),
      `Итого: ${formatPrice(payable)}`,
      "",
      `Получатель: ${name.trim()}`,
      `Телефон: ${phone.trim()}`,
      `Адрес: ${address.trim()}`,
      comment.trim() ? `Комментарий: ${comment.trim()}` : "",
    ].filter(Boolean);
    const url = `${contacts.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
    /*
      Номер показываем только настоящий, с сервера. Раньше при неудачном
      сохранении подставлялся выдуманный локальный «MO-…», которого магазин
      никогда не видел, — покупатель называл менеджеру номер, а тот его не
      находил. Без номера заказ всё равно уходит в WhatsApp полным составом.
    */
    setLastOrderId(orderNumber ?? "");
    setSent(true);
    setConsent(false);
    clear();
  }

  return (
    <>
      {/*
        Затемнение без backdrop-blur: размытие всего экрана пересчитывалось
        каждый кадр, пока корзина выезжает, и на телефоне съедало ровно ту
        плавность, ради которой этот выезд и сделан.
      */}
      <div
        onClick={closeCart}
        className={cn(
          "fixed inset-0 z-[90] bg-black/60 transition-opacity",
          shown ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        /*
          Закрытая корзина не должна ни перехватывать касания, ни попадать в
          порядок обхода табом: поля формы заказа оставались доступны с
          клавиатуры и в дереве доступности при закрытой корзине. visibility
          переключается ступенькой в конце перехода, поэтому выезд цел.
        */
        aria-hidden={!shown}
        className={cn(
          "fixed bottom-0 right-0 top-0 z-[100] w-[min(460px,100vw)] overflow-y-auto overscroll-contain border-l border-border bg-surface p-7 transition-[transform,visibility] duration-300 will-change-transform",
          shown ? "visible translate-x-0" : "invisible pointer-events-none translate-x-full",
        )}
      >
        <button
          onClick={closeCart}
          aria-label="Закрыть корзину"
          className="absolute right-2.5 top-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          <X size={16} />
        </button>

        <h3 className="mb-6 font-display text-lg font-semibold uppercase">
          Корзина
        </h3>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Заказ {lastOrderId && <b className="font-mono">{lastOrderId}</b>}{" "}
              сформирован и открыт в WhatsApp — отправьте сообщение, и менеджер
              подтвердит заказ в течение рабочего дня.
            </p>
            <p className="font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
              Копия заказа — в{" "}
              <a
                href="/profile"
                onClick={closeCart}
                className="text-[var(--signal-text)] underline underline-offset-2 hover:no-underline"
              >
                личном кабинете
              </a>{" "}
              на этом устройстве.
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
                      sizes="96px"
                      className="h-[85%] w-[85%] object-contain mix-blend-multiply"
                    />
                  </span>
                  <span>
                    <span className="block text-[0.84rem] font-medium leading-snug">
                      {i.title}
                    </span>
                    {/*
                      Кружки были по 24px — попасть пальцем можно только со
                      второго раза. Видимый размер оставляем прежним, а область
                      нажатия растягиваем псевдоэлементом до 44px: разметка от
                      этого не расходится.
                    */}
                    <span className="mt-1.5 inline-flex items-center gap-2">
                      <button
                        aria-label="Убавить"
                        onClick={() => setQty(i.slug, i.qty - 1)}
                        className="tap-44 relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-4 text-center font-mono text-xs tabular-nums">
                        {i.qty}
                      </span>
                      <button
                        aria-label="Прибавить"
                        onClick={() => setQty(i.slug, i.qty + 1)}
                        className="tap-44 relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        aria-label="Удалить из корзины"
                        onClick={() => remove(i.slug)}
                        className="tap-44 relative ml-1 inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-signal"
                      >
                        <Trash2 size={14} />
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
              {payEnabled && onlineDeliveryAvailable && (
                <div className="rounded-xl border border-border bg-bg p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin size={16} className="text-signal" />
                    Пункт Ozon
                  </p>
                  {delivery ? (
                    <div className="mt-2 text-[0.82rem] leading-relaxed">
                      <b>{delivery.point.name}</b>
                      <br />
                      <span className="text-muted-foreground">{delivery.point.address}</span>
                      <br />
                      <span className="font-semibold text-[var(--signal-text)]">
                        Доставка бесплатно
                      </span>
                      <button
                        type="button"
                        onClick={() => setDelivery(null)}
                        className="ml-2 text-muted-foreground underline underline-offset-2"
                      >
                        Изменить
                      </button>
                    </div>
                  ) : points.length ? (
                    <div className="mt-3 space-y-2">
                      <select
                        value={selectedPoint?.id ?? ""}
                        onChange={(event) =>
                          setSelectedPoint(
                            points.find((point) => point.id === Number(event.target.value)) ?? null,
                          )
                        }
                        className={inputCls}
                      >
                        {points.map((point) => (
                          <option key={point.id} value={point.id}>
                            {point.address} · {point.distanceKm} км
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={confirmPickup}
                        disabled={deliveryBusy || !selectedPoint}
                        className="w-full rounded-sm border border-signal px-4 py-2.5 text-sm font-semibold text-signal disabled:opacity-60"
                      >
                        {deliveryBusy ? "Проверяем маршрут…" : "Выбрать этот ПВЗ"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={locatePickupPoints}
                      disabled={deliveryBusy}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                    >
                      <LocateFixed size={15} />
                      {deliveryBusy ? "Ищем ближайшие ПВЗ…" : "Найти ПВЗ рядом"}
                    </button>
                  )}
                  {deliveryMsg && (
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-signal">{deliveryMsg}</p>
                  )}
                  <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                    Товары передаём в Ozon только после успешной оплаты.
                  </p>
                </div>
              )}
              {payEnabled && !onlineDeliveryAvailable && (
                <div className="rounded-xl border border-border bg-bg p-4 text-[0.8rem] leading-relaxed text-muted-foreground">
                  Онлайн-оплата с бесплатной доставкой в пункт Ozon доступна от{" "}
                  <b className="text-foreground">{formatPrice(freeFrom)}</b>. Для меньшей
                  суммы оформите заказ через WhatsApp — менеджер рассчитает доставку.
                </div>
              )}
            </div>

            {/* Промокод */}
            <div className="mt-4">
              {promo ? (
                <div className="flex items-center justify-between gap-2 rounded-sm border border-signal/40 bg-signal/10 px-3 py-2.5 text-[0.82rem]">
                  <span>
                    Промокод{" "}
                    <b className="font-semibold uppercase">{promo.code}</b> —
                    скидка{" "}
                    <b className="text-[var(--signal-text)]">{promo.percent}%</b>
                  </span>
                  <button
                    type="button"
                    onClick={removePromo}
                    aria-label="Убрать промокод"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-signal"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoMsg("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    placeholder="Промокод"
                    aria-label="Промокод"
                    className={cn(inputCls, "uppercase")}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoBusy || !promoInput.trim()}
                    className="shrink-0 rounded-sm border border-border px-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                  >
                    {promoBusy ? "…" : "Применить"}
                  </button>
                </div>
              )}
              {promoMsg && (
                <p className="mt-1.5 text-[0.78rem] text-signal">{promoMsg}</p>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-signal" role="alert">
                {error}
              </p>
            )}

            {discount > 0 && (
              <div className="mt-5 space-y-1 text-sm">
                <div className="flex items-baseline justify-between text-muted-foreground">
                  <span>Сумма</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[var(--signal-text)]">
                  <span>Скидка {promo?.percent}%</span>
                  <span>−{formatPrice(discount)}</span>
                </div>
              </div>
            )}
            <div className={cn("flex items-baseline justify-between", discount > 0 ? "mt-2" : "mt-5")}>
              <span className="text-sm">Итого</span>
              <span className="font-display text-xl font-extrabold">
                {formatPrice(payable)}
              </span>
            </div>
            <YandexSplitBadge
              amount={payable}
              size="m"
              variant="detailed"
              color="primary"
              className="mb-4 mt-2"
            />
            <ConsentCheckbox
              id="rc-consent"
              checked={consent}
              onChange={setConsent}
              className="mb-4"
            />
            {payEnabled ? (
              <>
                <button
                  onClick={() => submit(true)}
                  disabled={sending || !onlineDeliveryAvailable}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending
                    ? "Оформляем заказ…"
                    : !onlineDeliveryAvailable
                      ? `До онлайн-доставки не хватает ${formatPrice(remaining)}`
                    : customer
                      ? "Оплатить на сайте"
                      : "Войти и оплатить"}
                </button>
                <button
                  onClick={() => submit(false)}
                  disabled={sending}
                  className="mt-2.5 w-full rounded-sm border border-border py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                >
                  Оформить через WhatsApp
                </button>
                <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
                  {paySandbox
                    ? "Оплата работает в тестовом режиме: настоящие деньги не списываются."
                    : customer
                      ? "Карта берётся из текущего Яндекс ID на странице Яндекс Pay — проверьте аккаунт и последние 4 цифры. Заказ увидит менеджер только после оплаты."
                      : "Оплата доступна после входа или регистрации. Магазин не хранит карты: их показывает Яндекс Pay из текущего Яндекс ID."}
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => submit(false)}
                  disabled={sending}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? "Оформляем заказ…" : "Оформить через WhatsApp"}
                </button>
                <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
                  Заказ уйдёт менеджеру в WhatsApp: он подтвердит наличие,
                  назовёт стоимость доставки и пришлёт способы оплаты.
                </p>
              </>
            )}
          </>
        )}
      </aside>
    </>
  );
}

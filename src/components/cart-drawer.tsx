"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  Minus,
  Plus,
  Trash2,
  Truck,
  MapPin,
  LocateFixed,
  Search,
  Gift,
} from "lucide-react";
import { useCart, cartTotal } from "@/lib/cart-store";
import { formatPrice, productImageUrl } from "@/lib/format";
import { useSiteConfig } from "@/components/site-config-provider";
import { notifyCustomerSessionChanged, useCustomer } from "@/components/customer-provider";
import { useAccount } from "@/lib/account-store";
import { isPhoneComplete } from "@/lib/phone";
import {
  submitOrder,
  checkPromo,
  loadOzonPickupMap,
  searchPickupPlace,
  selectOzonPickup,
} from "@/app/order-actions";
import {
  CITY_CENTER_STORAGE_KEY,
  CITY_CHANGE_EVENT,
  CITY_STORAGE_KEY,
  parseStoredCityCenter,
  popularCityCenter,
  type CityCenter,
} from "@/lib/city-selection";
import type { PublicPlaceResult } from "@/lib/place-search";
import type {
  OzonDeliverySelection,
  PublicOzonCluster,
  PublicOzonPoint,
} from "@/lib/ozon-delivery";
import { ProductImage } from "./product-image";
import { PhoneInput } from "./phone-input";
import { ConsentCheckbox } from "./consent-checkbox";
import { cn } from "@/lib/utils";
import { YandexSplitBadge } from "./yandex-split-badge";
import type { MapTarget, MapView } from "./ozon-pickup-map";
import { METRIKA_GOALS, reachMetrikaGoal } from "@/lib/metrika";

const OzonPickupMap = dynamic(
  () => import("./ozon-pickup-map").then((module) => module.OzonPickupMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[360px] place-items-center bg-tile font-mono text-xs text-muted-foreground sm:h-[440px]">
        Загружаем карту…
      </div>
    ),
  },
);

// Данные получателя запоминаем — при повторном заказе не вводить заново.
const RECIPIENT_KEY = "momo-recipient";

// text-base на узком экране: при шрифте меньше 16px Safari на iPhone
// приближает страницу, как только человек ставит курсор в поле, и обратно
// уже не отдаляет. См. тот же комментарий в catalog-view.tsx.
const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-base text-foreground transition-colors focus:border-signal focus:outline-none sm:text-sm";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

const russiaMapTarget: MapTarget = { lat: 61.2, long: 89.2, zoom: 2 };
type CheckoutField = "name" | "phone" | "address" | "consent" | "delivery";

export function CartPageClient() {
  const { items, setQty, remove, clear } = useCart();
  const customer = useCustomer();
  const openAuth = useAccount((s) => s.openModal);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [sent, setSent] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [sending, setSending] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number; discount: number } | null>(
    null,
  );
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [points, setPoints] = useState<PublicOzonPoint[]>([]);
  const [clusters, setClusters] = useState<PublicOzonCluster[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PublicOzonPoint | null>(null);
  const [delivery, setDelivery] = useState<OzonDeliverySelection | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState("");
  const [mapTarget, setMapTarget] = useState<MapTarget>(russiaMapTarget);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PublicPlaceResult[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const mapRequestRef = useRef(0);
  const lastMapViewRef = useRef<MapView | null>(null);
  const deliveryPickerRef = useRef<HTMLDivElement>(null);
  const payButtonRef = useRef<HTMLButtonElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    requestAnimationFrame(() => errorSummaryRef.current?.focus());
  }, [error]);

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

  // Если город действительно выбирали в шапке, начинаем с него. Без сохранённого
  // выбора показываем всю Россию — карта больше не привязана к Махачкале.
  useEffect(() => {
    const applyCityCenter = (center: CityCenter | null) => {
      if (center) setMapTarget({ lat: center.lat, long: center.long, zoom: 11 });
    };
    const city = localStorage.getItem(CITY_STORAGE_KEY);
    applyCityCenter(
      popularCityCenter(city) ??
        parseStoredCityCenter(localStorage.getItem(CITY_CENTER_STORAGE_KEY), city),
    );

    const onCityChange = (event: Event) => {
      const detail = (event as CustomEvent<Partial<CityCenter>>).detail;
      if (
        typeof detail?.city === "string" &&
        Number.isFinite(detail.lat) &&
        Number.isFinite(detail.long)
      ) {
        applyCityCenter({ city: detail.city, lat: detail.lat!, long: detail.long! });
      } else if (typeof detail?.city === "string") {
        applyCityCenter(popularCityCenter(detail.city));
      }
    };
    window.addEventListener(CITY_CHANGE_EVENT, onCityChange);
    return () => window.removeEventListener(CITY_CHANGE_EVENT, onCityChange);
  }, []);

  const { trust, payEnabled, paySandbox } = useSiteConfig();
  const total = cartTotal(items);
  const freeFrom = trust.freeShippingFrom;

  // Предпросмотр использует тот же серверный расчёт, что окончательный заказ:
  // ограничения по товарам/категориям и максимальная скидка не расходятся.
  const discount = promo?.discount ?? 0;
  const payable = total - discount;
  const bonusLimit = customer
    ? Math.min(customer.bonusBalance, Math.floor(payable * 0.3))
    : 0;
  const bonusSpent = Math.min(Math.max(0, bonusAmount), bonusLimit);
  const goodsPayable = payable - bonusSpent;
  const deliveryCharge = delivery?.customerPrice ?? 0;
  const payableWithDelivery = goodsPayable + deliveryCharge;
  // Бесплатная онлайн-доставка считается от суммы, которую реально заплатят.
  const remaining = Math.max(0, freeFrom - goodsPayable);
  const shippingPct = Math.min(100, (goodsPayable / freeFrom) * 100);

  useEffect(() => {
    setBonusAmount((value) => Math.min(value, bonusLimit));
  }, [bonusLimit]);

  useEffect(() => {
    setDelivery(null);
  }, [phone, items]);

  useEffect(() => {
    if (!promo?.code) return;
    let cancelled = false;
    void checkPromo(
      promo.code,
      items.map((item) => ({ slug: item.slug, qty: item.qty })),
      phone,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPromo({ code: result.code, percent: result.percent, discount: result.discount });
      } else {
        setPromo(null);
        setPromoMsg(result.error);
      }
    });
    return () => { cancelled = true; };
  }, [promo?.code, items, phone]);

  async function loadMapArea(view: MapView) {
    lastMapViewRef.current = view;
    if (view.zoom < 5) {
      mapRequestRef.current += 1;
      setMapBusy(false);
      setPoints([]);
      setClusters([]);
      setDeliveryMsg("Найдите свой город или приблизьте нужную область карты.");
      return;
    }
    const requestId = ++mapRequestRef.current;
    setMapBusy(true);
    const result = await loadOzonPickupMap({
      viewport: view.viewport,
      zoom: view.zoom,
    });
    if (requestId !== mapRequestRef.current) return;
    setMapBusy(false);
    if (!result.ok) {
      setDeliveryMsg(result.error);
      return;
    }
    setPoints(result.area.points);
    setClusters(result.area.clusters);
    if (!result.area.points.length && !result.area.clusters.length) {
      setDeliveryMsg("В этой области пункты Ozon не найдены. Переместите карту.");
    } else if (result.area.clusters.length) {
      setDeliveryMsg("Нажмите на синюю группу ПВЗ, чтобы приблизить карту.");
    } else {
      setDeliveryMsg("Выберите синюю метку или адрес под картой.");
    }
  }

  async function locatePickupPoints() {
    if (!("geolocation" in navigator)) {
      setDeliveryMsg("Переместите карту в свой город и нажмите «Показать ПВЗ здесь».");
      return;
    }
    setDeliveryBusy(true);
    setDeliveryMsg("Разрешите доступ к геопозиции — покажем ближайшие ПВЗ Ozon.");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setDeliveryBusy(false);
        setMapTarget({ lat: coords.latitude, long: coords.longitude, zoom: 13 });
        setDeliveryMsg("Показываем пункты Ozon рядом с вами…");
      },
      () => {
        setDeliveryBusy(false);
        setDeliveryMsg("Доступ не нужен: переместите карту в свой город и нажмите «Показать ПВЗ здесь».");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function findPlace(event?: FormEvent) {
    event?.preventDefault();
    if (placeQuery.trim().length < 2) {
      setDeliveryMsg("Введите город, улицу или адрес.");
      return;
    }
    setPlaceBusy(true);
    setPlaceResults([]);
    const result = await searchPickupPlace(placeQuery);
    setPlaceBusy(false);
    if (!result.ok) {
      setDeliveryMsg(result.error);
      return;
    }
    setPlaceResults(result.places);
    setDeliveryMsg("Выберите подходящий адрес из списка.");
  }

  function choosePlace(place: PublicPlaceResult) {
    setPlaceQuery(place.label);
    setPlaceResults([]);
    setMapTarget({ lat: place.lat, long: place.long, zoom: place.zoom });
    setSelectedPoint(null);
    setDelivery(null);
    setDeliveryMsg("Загружаем пункты Ozon в выбранной области…");
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
    setAddress(`ПВЗ Ozon: ${result.delivery.point.address}`);
    setDeliveryMsg("ПВЗ выбран. Теперь можно перейти к оплате.");
    requestAnimationFrame(() =>
      payButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg("");
    const res = await checkPromo(
      code,
      items.map((item) => ({ slug: item.slug, qty: item.qty })),
      phone,
    );
    setPromoBusy(false);
    if (res.ok) {
      setPromo({ code: res.code, percent: res.percent, discount: res.discount });
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
    if (pay && !customer) {
      setError("Для оплаты на сайте войдите или зарегистрируйтесь.");
      openAuth("checkout");
      return;
    }
    if (pay && !delivery) {
      setError("");
      setFieldErrors({ delivery: "Выберите и подтвердите пункт выдачи Ozon." });
      if (!points.length && !clusters.length && !mapBusy && lastMapViewRef.current) {
        void loadMapArea(lastMapViewRef.current);
      }
      requestAnimationFrame(() =>
        deliveryPickerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      return;
    }
    const nextErrors: Partial<Record<CheckoutField, string>> = {};
    if (!name.trim()) nextErrors.name = "Укажите фамилию и имя получателя.";
    if (!phone.trim() || !isPhoneComplete(phone)) {
      nextErrors.phone = "Введите 10 цифр номера после +7.";
    }
    if (!address.trim()) nextErrors.address = "Укажите адрес доставки.";
    // Согласие на обработку ПД не запоминаем — его дают заново на каждый заказ.
    if (!consent) nextErrors.consent = "Подтвердите согласие на обработку данных.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Проверьте отмеченные поля.");
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setFieldErrors({});
    setError("");
    setSending(true);
    reachMetrikaGoal(METRIKA_GOALS.checkoutStart, { payment: pay ? "online" : "manager" });

    /*
      Сначала сохраняем заказ на сервере. Обычная заявка сразу появляется в
      панели; онлайн-запись остаётся скрытой до подтверждённой оплаты.
      Без серверной записи заказ не считаем оформленным.
    */
    const saved = await submitOrder({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      comment: comment.trim(),
      items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
      pay,
      ...(promo ? { promoCode: promo.code } : {}),
      ...(bonusSpent > 0 ? { bonusAmount: bonusSpent } : {}),
      ...(pay && delivery ? { deliveryToken: delivery.token } : {}),
    });
    setSending(false);
    const orderNumber = saved.ok ? saved.id : null;
    if (saved.ok) {
      reachMetrikaGoal(METRIKA_GOALS.orderCreated, { payment: pay ? "online" : "manager" });
    }
    if (saved.ok && bonusSpent > 0) notifyCustomerSessionChanged();

    if (pay && !saved.ok) {
      setError(saved.error);
      if (saved.requiresAuth) openAuth("checkout");
      return;
    }
    if (!pay && !saved.ok) {
      setError(
        bonusSpent > 0
          ? "Не удалось закрепить бонусы за заказом. Попробуйте ещё раз — баланс не изменился."
          : saved.error,
      );
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
      reachMetrikaGoal(METRIKA_GOALS.paymentStarted);
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
    // Обычный заказ уже сохранён на сервере и доступен менеджеру в админке.
    setLastOrderId(orderNumber ?? "");
    setSent(true);
    setConsent(false);
    clear();
  }

  function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void submit(submitter?.value === "online");
  }

  return (
    <main className="min-h-[70vh] bg-bg py-7 sm:py-12">
      <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6">
        <Link
          href="/catalog"
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-signal"
        >
          <ArrowLeft size={15} />
          Продолжить покупки
        </Link>
        <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-signal">
              Оформление заказа
            </p>
            <h1 className="font-display text-2xl font-semibold uppercase sm:text-4xl">
              Корзина
            </h1>
          </div>
          {items.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {items.reduce((sum, item) => sum + item.qty, 0)} шт.
            </span>
          )}
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Заказ {lastOrderId && <b className="font-mono">{lastOrderId}</b>}{" "}
              принят. Менеджер свяжется с вами и подтвердит заказ в течение
              рабочего дня.
            </p>
            <p className="font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
              Копия заказа — в{" "}
              <a
                href="/profile"
                className="text-[var(--signal-text)] underline underline-offset-2 hover:no-underline"
              >
                личном кабинете
              </a>{" "}
              на этом устройстве.
            </p>
            <Link
              href="/catalog"
              onClick={() => setSent(false)}
              className="block w-full rounded-sm border border-border py-3 text-center text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Вернуться к покупкам
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              В корзине пока пусто. Добавьте товары из каталога — они появятся
              здесь.
            </p>
            <Link
              href="/catalog"
              className="inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Открыть каталог
            </Link>
          </div>
        ) : (
          <form noValidate onSubmit={handleCheckoutSubmit}>
            {(error || Object.keys(fieldErrors).length > 0) && (
              <div
                ref={errorSummaryRef}
                role="alert"
                tabIndex={-1}
                aria-labelledby="checkout-error-title"
                className="mb-5 rounded-lg border border-signal/40 bg-signal/5 p-4"
              >
                <h2 id="checkout-error-title" className="text-sm font-semibold">
                  Не удалось продолжить
                </h2>
                {error && <p className="mt-1 text-sm text-[var(--signal-text)]">{error}</p>}
                {Object.keys(fieldErrors).length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {Object.entries(fieldErrors).map(([field, message]) => (
                      <li key={field}>
                        <a href={`#rc-${field}`} className="underline underline-offset-2 hover:text-signal">
                          {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                        type="button"
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
                        type="button"
                        aria-label="Прибавить"
                        onClick={() => setQty(i.slug, i.qty + 1)}
                        className="tap-44 relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
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
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                  }}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  aria-describedby={fieldErrors.name ? "rc-name-error" : undefined}
                  placeholder="Фамилия Имя Отчество"
                  className={inputCls}
                />
                {fieldErrors.name && <p id="rc-name-error" className="mt-1 text-sm text-[var(--signal-text)]">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-phone">
                  Телефон
                </label>
                <PhoneInput
                  id="rc-phone"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    setFieldErrors((current) => ({ ...current, phone: undefined }));
                  }}
                  required
                  ariaInvalid={Boolean(fieldErrors.phone)}
                  ariaDescribedBy={fieldErrors.phone ? "rc-phone-error" : undefined}
                  className={inputCls}
                />
                {fieldErrors.phone && <p id="rc-phone-error" className="mt-1 text-sm text-[var(--signal-text)]">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-address">
                  Адрес доставки
                </label>
                <textarea
                  id="rc-address"
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setFieldErrors((current) => ({ ...current, address: undefined }));
                  }}
                  rows={2}
                  autoComplete="street-address"
                  placeholder="Город, улица, дом, квартира"
                  aria-invalid={Boolean(fieldErrors.address) || undefined}
                  aria-describedby={fieldErrors.address ? "rc-address-error" : undefined}
                  className={inputCls}
                />
                {fieldErrors.address && <p id="rc-address-error" className="mt-1 text-sm text-[var(--signal-text)]">{fieldErrors.address}</p>}
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
              {payEnabled && (
                <div
                  id="rc-delivery"
                  ref={deliveryPickerRef}
                  aria-describedby={fieldErrors.delivery ? "rc-delivery-error" : undefined}
                  className="overflow-hidden rounded-2xl border border-signal/50 bg-signal/5"
                >
                  <div className="border-b border-border bg-surface p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin size={16} className="text-[#005bff]" />
                          Пункты Ozon по всей России
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Найдите город или адрес либо приблизьте нужную область карты.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={locatePickupPoints}
                          disabled={deliveryBusy || mapBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-[#005bff] hover:text-[#005bff] disabled:opacity-60 sm:flex-none"
                        >
                          <LocateFixed size={14} />
                          Рядом со мной
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMapTarget(russiaMapTarget);
                            setPlaceResults([]);
                            setDeliveryMsg("Показываем пункты Ozon по всей России.");
                          }}
                          className="inline-flex flex-1 items-center justify-center rounded-sm border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-[#005bff] hover:text-[#005bff] sm:flex-none"
                        >
                          Вся Россия
                        </button>
                      </div>
                    </div>
                    <div className="relative mt-3 flex gap-2">
                      <label htmlFor="ozon-place-search" className="sr-only">
                        Город или адрес для поиска ПВЗ Ozon
                      </label>
                      <div className="relative min-w-0 flex-1">
                        <Search
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          id="ozon-place-search"
                          value={placeQuery}
                          onChange={(event) => {
                            setPlaceQuery(event.target.value);
                            setPlaceResults([]);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void findPlace();
                            }
                          }}
                          placeholder="Например: Москва, Тверская улица"
                          autoComplete="off"
                          className="w-full rounded-sm border border-input bg-background py-2.5 pl-9 pr-3 text-base outline-none transition-colors focus:border-[#005bff] sm:text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void findPlace()}
                        disabled={placeBusy || placeQuery.trim().length < 2}
                        className="rounded-sm bg-[#005bff] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0047c7] disabled:opacity-60"
                      >
                        {placeBusy ? "Ищем…" : "Найти"}
                      </button>
                    </div>
                    {placeResults.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                        {placeResults.map((place) => (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => choosePlace(place)}
                            className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left text-xs leading-relaxed transition-colors last:border-b-0 hover:bg-[#005bff]/5"
                          >
                            <MapPin size={14} className="mt-0.5 shrink-0 text-[#005bff]" />
                            <span>{place.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <OzonPickupMap
                      target={mapTarget}
                      points={points}
                      clusters={clusters}
                      selectedPointId={selectedPoint?.id}
                      onViewChange={(view) => {
                        setMapTarget({ lat: view.lat, long: view.long, zoom: view.zoom });
                        void loadMapArea(view);
                      }}
                      onSelect={(point) => {
                        setSelectedPoint(point);
                        setDelivery(null);
                        setFieldErrors((current) => ({ ...current, delivery: undefined }));
                        setDeliveryMsg("Проверьте адрес и подтвердите выбранный ПВЗ.");
                      }}
                    />
                    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[0.68rem] font-semibold text-[#005bff] shadow-md backdrop-blur dark:bg-[#151515]/95">
                      {mapBusy
                        ? "Обновляем ПВЗ…"
                        : mapTarget.zoom < 5
                          ? "Найдите свой город"
                          : `На карте: ${points.length + clusters.reduce((sum, cluster) => sum + cluster.pointsCount, 0)}`}
                    </div>
                  </div>
                  <div className="bg-surface p-4">
                    {points.length > 0 && (
                      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {points.map((point) => (
                          <button
                            key={point.id}
                            type="button"
                            onClick={() => {
                              setSelectedPoint(point);
                              setDelivery(null);
                              setDeliveryMsg("Проверьте адрес и подтвердите выбранный ПВЗ.");
                            }}
                            className={cn(
                              "rounded-lg border p-3 text-left text-xs leading-relaxed transition-colors",
                              selectedPoint?.id === point.id
                                ? "border-signal bg-signal/10"
                                : "border-border hover:border-signal/60",
                            )}
                          >
                            <b className="block text-foreground">{point.name}</b>
                            <span className="mt-1 block text-muted-foreground">
                              {point.address} · {point.distanceKm} км
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedPoint && (
                      <div className="mt-3 rounded-xl border border-border bg-bg p-3 text-sm leading-relaxed">
                        <b>{selectedPoint.name}</b>
                        <span className="mt-1 block text-muted-foreground">
                          {selectedPoint.address}
                        </span>
                        {delivery && (
                          <span className="mt-1 block font-semibold text-[var(--signal-text)]">
                            ПВЗ подтверждён · доставка бесплатно
                          </span>
                        )}
                      </div>
                    )}
                    {!delivery && (
                      <button
                        type="button"
                        onClick={confirmPickup}
                        disabled={deliveryBusy || !selectedPoint}
                        className="mt-3 w-full rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
                      >
                        {deliveryBusy ? "Проверяем маршрут…" : "Подтвердить выбранный ПВЗ"}
                      </button>
                    )}
                    {deliveryMsg && (
                      <p className="mt-2 text-[0.78rem] leading-relaxed text-signal">
                        {deliveryMsg}
                      </p>
                    )}
                    {fieldErrors.delivery && (
                      <p id="rc-delivery-error" className="mt-2 text-sm text-[var(--signal-text)]">
                        {fieldErrors.delivery}
                      </p>
                    )}
                    <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                      Товары передаём в Ozon только после успешной оплаты.
                    </p>
                  </div>
                </div>
              )}
              {payEnabled && (
                <div className="rounded-xl border border-border bg-bg p-4 text-[0.8rem] leading-relaxed text-muted-foreground">
                  Онлайн-доставка с Ozon доступна для любого чека: если сумма заказа ниже{" "}
                  <b className="text-foreground">{formatPrice(freeFrom)}</b>, к оплате добавляется{" "}
                  300 ₽ за доставку до пункта выдачи Ozon.
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
                    <b className="text-[var(--signal-text)]">{formatPrice(promo.discount)} ({promo.percent}%)</b>
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyPromo();
                      }
                    }}
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

            {customer && customer.bonusBalance > 0 && (
              <div className="mt-4 rounded-xl border border-signal/25 bg-signal/[0.045] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Gift size={17} className="text-signal" />
                    <div>
                      <p className="text-[0.82rem] font-semibold">Использовать бонусы</p>
                      <p className="text-[0.72rem] text-muted-foreground">Баланс: {customer.bonusBalance} · доступно сейчас: {bonusLimit}</p>
                    </div>
                  </div>
                  {bonusSpent > 0 && (
                    <button type="button" onClick={() => setBonusAmount(0)} className="text-[0.72rem] text-muted-foreground hover:text-signal">Убрать</button>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={bonusLimit}
                    step={1}
                    value={bonusAmount || ""}
                    onChange={(event) => {
                      const value = Math.floor(Number(event.target.value) || 0);
                      setBonusAmount(Math.min(Math.max(0, value), bonusLimit));
                    }}
                    placeholder="Сколько списать"
                    aria-label="Количество бонусов"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setBonusAmount(bonusLimit)}
                    disabled={bonusLimit === 0}
                    className="shrink-0 rounded-sm border border-border px-3 text-[0.78rem] font-semibold hover:border-signal hover:text-signal disabled:opacity-50"
                  >
                    Максимум
                  </button>
                </div>
                <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">1 бонус = 1 ₽. Можно оплатить до 30% товаров; доставка бонусами не оплачивается.</p>
              </div>
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
            {bonusSpent > 0 && (
              <div className="mt-2 flex items-baseline justify-between text-sm text-[var(--signal-text)]">
                <span>Оплата бонусами</span>
                <span>−{formatPrice(bonusSpent)}</span>
              </div>
            )}
            <div className={cn("flex items-baseline justify-between", discount > 0 || bonusSpent > 0 ? "mt-2" : "mt-5")}>
              <span className="text-sm">Итого</span>
              <span className="font-display text-xl font-extrabold">
                {formatPrice(payableWithDelivery)}
              </span>
            </div>
            {deliveryCharge > 0 && (
              <div className="mt-1.5 flex items-baseline justify-between text-sm text-muted-foreground">
                <span>Доставка Ozon (самовывоз)</span>
                <span>+ {formatPrice(deliveryCharge)}</span>
              </div>
            )}
            <YandexSplitBadge
              amount={payableWithDelivery}
              size="m"
              variant="detailed"
              color="primary"
              className="mb-4 mt-2"
            />
            <ConsentCheckbox
              id="rc-consent"
              checked={consent}
              onChange={(value) => {
                setConsent(value);
                setFieldErrors((current) => ({ ...current, consent: undefined }));
              }}
              ariaInvalid={Boolean(fieldErrors.consent)}
              ariaDescribedBy={fieldErrors.consent ? "rc-consent-error" : undefined}
              className="mb-4"
            />
            {fieldErrors.consent && (
              <p id="rc-consent-error" className="-mt-2 mb-4 text-sm text-[var(--signal-text)]">
                {fieldErrors.consent}
              </p>
            )}
            {payEnabled ? (
              <>
                <button
                  type="submit"
                  name="checkoutMode"
                  value="online"
                  ref={payButtonRef}
                  disabled={sending}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? "Оформляю заказ…" : customer ? "Оплатить на сайте" : "Войти и оплатить"}
                </button>
                <button
                  type="submit"
                  name="checkoutMode"
                  value="offline"
                  disabled={sending}
                  className="mt-2.5 w-full rounded-sm border border-border py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                >
                  Заказать без онлайн-оплаты
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
                  type="submit"
                  name="checkoutMode"
                  value="offline"
                  disabled={sending}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? "Оформляем заказ…" : "Оформить заказ"}
                </button>
                <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
                  Заказ появится у менеджера: он подтвердит наличие, назовёт
                  стоимость доставки и свяжется с вами для оплаты.
                </p>
              </>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

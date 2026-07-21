"use client";

import { useEffect, useState } from "react";
import { User, LogOut, Trash2, Package } from "lucide-react";
import { useAccount } from "@/lib/account-store";
import { useToast } from "@/lib/toast-store";
import { readOrders, clearOrders, type LocalOrder } from "@/lib/local-orders";
import { formatPrice } from "@/lib/data";
import { isPhoneComplete } from "@/lib/phone";
import { PhoneInput } from "./phone-input";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

// Адрес доставки живёт там же, где его читает корзина
const RECIPIENT_KEY = "momo-recipient";

/*
  Личный кабинет ЛОКАЛЬНОГО аккаунта: данные и заказы — только этого браузера,
  о чём страница говорит прямо. Серверная версия (Фаза 3) заменит начинку,
  сохранив разметку.
*/
export function ProfileView() {
  const account = useAccount((s) => s.account);
  const authed = useAccount((s) => s.authed);
  const openModal = useAccount((s) => s.openModal);
  const logout = useAccount((s) => s.logout);
  const deleteAccount = useAccount((s) => s.deleteAccount);
  const updateProfile = useAccount((s) => s.updateProfile);
  const pushToast = useToast((s) => s.push);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<LocalOrder[]>([]);

  // Гидрация: до маунта рендерим нейтральную заглушку, чтобы серверный HTML
  // (не знающий про localStorage) совпал с первым клиентским рендером.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Заполняем форму из аккаунта и momo-recipient при входе/маунте
  useEffect(() => {
    if (!mounted || !authed || !account) return;
    setName(account.name);
    setEmail(account.email);
    setPhone(account.phone);
    try {
      const saved = localStorage.getItem(RECIPIENT_KEY);
      if (saved) setAddress(JSON.parse(saved).address ?? "");
    } catch {}
    setOrders(readOrders());
  }, [mounted, authed, account]);

  if (!mounted) {
    return <main className="mx-auto min-h-[50vh] max-w-[1000px] px-4 py-14 sm:px-6" />;
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-[1000px] items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <User size={20} />
          </span>
          <h1 className="mt-5 font-display text-xl font-extrabold uppercase">
            Личный кабинет
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Войдите или создайте аккаунт: данные доставки будут подставляться
            в корзину сами, а заказы — собираться в историю. Аккаунт хранится
            на этом устройстве, пароль — только необратимым хешем.
          </p>
          <button
            onClick={openModal}
            className="mt-6 w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
          >
            Войти или зарегистрироваться
          </button>
        </div>
      </main>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneComplete(phone)) {
      setError("Проверьте телефон — в номере должно быть 10 цифр после +7.");
      return;
    }
    setError("");
    updateProfile({ name, email, phone });
    try {
      localStorage.setItem(
        RECIPIENT_KEY,
        JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
      );
    } catch {}
    pushToast({
      title: "Сохранено",
      description: "Эти данные подставятся при оформлении заказа.",
    });
  }

  function onLogout() {
    logout();
    pushToast({ title: "Вы вышли", description: "Данные остались на устройстве." });
  }

  function onDelete() {
    if (
      !window.confirm(
        "Удалить аккаунт и все данные на этом устройстве — профиль, адрес доставки и историю заказов? Действие необратимо.",
      )
    )
      return;
    deleteAccount();
    clearOrders();
    try {
      localStorage.removeItem(RECIPIENT_KEY);
    } catch {}
    pushToast({ title: "Аккаунт удалён", description: "Данные стёрты с устройства." });
  }

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-label text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Аккаунт на этом устройстве
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold uppercase leading-tight">
        Личный кабинет
      </h1>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.2fr]">
        {/* Мои данные */}
        <section>
          <h2 className="font-display text-lg font-extrabold uppercase">
            Мои данные
          </h2>
          <form onSubmit={save} className="mt-5 space-y-3.5">
            <div>
              <label className={labelCls} htmlFor="pf-name">
                Имя
              </label>
              <input
                id="pf-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-email">
                Email
              </label>
              <input
                id="pf-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-phone">
                Телефон
              </label>
              <PhoneInput
                id="pf-phone"
                value={phone}
                onChange={setPhone}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-addr">
                Адрес доставки
              </label>
              <textarea
                id="pf-addr"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                placeholder="Город, улица, дом, квартира"
                className={inputCls}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-signal">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-sm bg-signal py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              Сохранить
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              <LogOut size={14} />
              Выйти
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              <Trash2 size={14} />
              Удалить аккаунт
            </button>
          </div>
        </section>

        {/* Мои заказы */}
        <section>
          <h2 className="font-display text-lg font-extrabold uppercase">
            Мои заказы
          </h2>
          {orders.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-10 text-center">
              <Package size={22} className="text-muted-foreground" />
              <p className="max-w-[36ch] text-sm text-muted-foreground">
                Заказы, оформленные с этого устройства, появятся здесь. Пока их
                нет.
              </p>
              <a
                href="/catalog"
                className="mt-1 inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
              >
                Открыть каталог
              </a>
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground">
                      {o.id} ·{" "}
                      {new Date(o.date).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                      передан в WhatsApp
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {o.items.map((i) => (
                      <li
                        key={i.slug}
                        className="flex items-baseline justify-between gap-4 text-[0.85rem]"
                      >
                        <a
                          href={`/product/${i.slug}`}
                          className="leading-snug transition-colors hover:text-signal"
                        >
                          {i.title}
                        </a>
                        <span className="shrink-0 font-mono text-[0.78rem] text-muted-foreground">
                          {i.qty} × {formatPrice(i.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-sm">Итого</span>
                    <span className="font-display text-base font-extrabold">
                      {formatPrice(o.total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

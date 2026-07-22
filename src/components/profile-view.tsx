"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Package } from "lucide-react";
import { useAccount } from "@/lib/account-store";
import { useToast } from "@/lib/toast-store";
import { formatPrice } from "@/lib/format";
import { isPhoneComplete } from "@/lib/phone";
import { PhoneInput } from "./phone-input";
import { saveProfile, signOut } from "@/app/customer-actions";
import { STATUS_LABELS } from "@/lib/order-status";
import type { Order, PublicCustomer } from "@/lib/types";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

/*
  Личный кабинет.

  Данные и заказы приходят с сервера: аккаунт общий для всех устройств, и
  история покупок больше не пропадает вместе с очисткой браузера. Почта
  служит логином и здесь не меняется — иначе можно случайно потерять вход.
*/
export function ProfileView({
  customer,
  orders,
}: {
  customer: PublicCustomer | null;
  orders: Order[];
}) {
  const router = useRouter();
  const openModal = useAccount((s) => s.openModal);
  const pushToast = useToast((s) => s.push);

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!customer) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-[1000px] items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <User size={20} />
          </span>
          <h1 className="mt-5 font-display text-xl font-extrabold uppercase">
            Личный кабинет
          </h1>
          <p className="mt-3 text-[0.92rem] leading-relaxed text-muted-foreground">
            Войдите, чтобы видеть свои заказы и не вводить данные доставки
            заново. Аккаунт работает на всех ваших устройствах.
          </p>
          <button
            onClick={openModal}
            className="mt-6 w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99]"
          >
            Войти или зарегистрироваться
          </button>
        </div>
      </main>
    );
  }

  async function save() {
    if (!name.trim()) {
      setError("Впишите имя.");
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError("Проверьте телефон — в номере должно быть 10 цифр после +7.");
      return;
    }
    setError("");
    setBusy(true);
    const result = await saveProfile({
      name: name.trim(),
      phone,
      address: address.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    pushToast({
      title: "Сохранено",
      description: "Данные подставятся в следующий заказ.",
    });
    router.refresh();
  }

  async function exit() {
    await signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.6rem,3.2vw,2.2rem)] font-extrabold uppercase">
            {customer.name}
          </h1>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            {customer.email} · с нами с{" "}
            {new Date(customer.createdAt).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <button
          onClick={exit}
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-[0.85rem] transition-all hover:border-signal hover:text-signal active:scale-95"
        >
          <LogOut size={15} /> Выйти
        </button>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Данные доставки */}
        <section>
          <h2 className="font-display text-[1.05rem] font-semibold uppercase">
            Данные доставки
          </h2>
          <p className="mt-1.5 text-[0.82rem] text-muted-foreground">
            Подставляются в корзину — не придётся вводить заново.
          </p>

          <div className="mt-5 space-y-3.5">
            <div>
              <label className={labelCls} htmlFor="pf-name">
                Имя
              </label>
              <input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-phone">
                Телефон
              </label>
              <PhoneInput id="pf-phone" value={phone} onChange={setPhone} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-address">
                Адрес доставки
              </label>
              <textarea
                id="pf-address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Город, улица, дом, квартира"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-[0.85rem] text-[var(--signal-text)]">{error}</p>
            )}

            <button
              onClick={save}
              disabled={busy}
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </section>

        {/* Заказы */}
        <section>
          <h2 className="font-display text-[1.05rem] font-semibold uppercase">
            Мои заказы
          </h2>

          {orders.length === 0 ? (
            <div className="mt-5 rounded-xl border border-border bg-surface p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Package size={18} />
              </span>
              <p className="mt-4 text-[0.9rem] text-muted-foreground">
                Заказов пока нет. Оформите первый — он появится здесь с номером
                и составом.
              </p>
              <Link
                href="/catalog"
                className="mt-5 inline-flex rounded-sm border border-border px-5 py-2.5 text-[0.85rem] font-semibold transition-all hover:border-signal hover:text-signal active:scale-95"
              >
                В каталог
              </Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-mono font-medium">№ {o.id}</span>
                    <span className="text-[0.8rem] text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                    <span className="rounded-sm border border-border px-2 py-0.5 text-[0.72rem] text-muted-foreground">
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[0.88rem]">
                    {o.items.map((i) => (
                      <li key={i.slug} className="flex justify-between gap-4">
                        <Link
                          href={`/product/${i.slug}`}
                          className="text-muted-foreground transition-colors hover:text-signal"
                        >
                          {i.title}
                        </Link>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {i.qty} × {formatPrice(i.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-border pt-3 text-right font-semibold">
                    {formatPrice(o.total)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/lib/cart-store";
import { useAccount } from "@/lib/account-store";

/*
  Корзина и окно входа — по требованию.

  Раньше обе висели в разметке каждой страницы: полная форма заказа с полями
  получателя, маской телефона, согласием и серверными действиями плюс форма
  входа с регистрацией — всё это уезжало в первый же бандл и разбиралось
  браузером до того, как человек хоть раз нажал на корзину.

  Теперь их код лежит отдельными кусками и подгружается либо когда покупатель
  открыл окно, либо тихо в простое после гидратации — что случится раньше.
  Предзагрузка нужна, чтобы первое открытие не ждало сети: к моменту, когда
  что-то положат в корзину, кусок обычно уже на месте.
*/

const CartDrawer = dynamic(
  () => import("./cart-drawer").then((m) => m.CartDrawer),
  { ssr: false },
);

const AuthModal = dynamic(
  () => import("./auth-modal").then((m) => m.AuthModal),
  { ssr: false },
);

export function Overlays() {
  const cartOpen = useCart((s) => s.isOpen);
  const authOpen = useAccount((s) => s.modalOpen);

  // Один раз смонтировали — держим: закрытие не должно выгружать форму
  // вместе с уже набранными полями.
  const [cartReady, setCartReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (cartOpen) setCartReady(true);
  }, [cartOpen]);

  useEffect(() => {
    if (authOpen) setAuthReady(true);
  }, [authOpen]);

  // Тихая предзагрузка в простое — чтобы первое открытие было мгновенным
  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 2000));
    const id = idle(() => {
      setCartReady(true);
      setAuthReady(true);
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  return (
    <>
      {cartReady && <CartDrawer />}
      {authReady && <AuthModal />}
    </>
  );
}

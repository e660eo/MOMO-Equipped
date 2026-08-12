import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart-drawer";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Оформление заказа MOMO: выбор пункта Ozon и оплата на сайте.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageClient />;
}

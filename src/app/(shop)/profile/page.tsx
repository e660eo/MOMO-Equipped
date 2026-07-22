import type { Metadata } from "next";
import { ProfileView } from "@/components/profile-view";
import { currentCustomer } from "@/lib/customer-auth";
import { getOrders } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Личный кабинет",
  description: "Данные доставки и история заказов MOMO.",
  // Приватная страница: в выдаче ей делать нечего (и в sitemap её нет)
  robots: { index: false, follow: false },
};

/*
  Кабинет покупателя. Данные и заказы читает сервер по подписанной куке:
  раньше всё лежало в браузере и пропадало вместе с очисткой кэша, а на
  другом устройстве заказов будто и не было.
*/
export default async function ProfilePage() {
  const customer = await currentCustomer();
  const orders = customer
    ? getOrders().filter((o) => o.customerId === customer.id)
    : [];

  return <ProfileView customer={customer} orders={orders} />;
}

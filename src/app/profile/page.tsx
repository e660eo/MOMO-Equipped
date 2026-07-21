import type { Metadata } from "next";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = {
  title: "Личный кабинет",
  description:
    "Данные доставки и история заказов MOMO — хранятся на вашем устройстве.",
  // Приватная страница: в выдаче ей делать нечего (и в sitemap её нет)
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileView />;
}

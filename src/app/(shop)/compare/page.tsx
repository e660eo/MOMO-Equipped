import type { Metadata } from "next";
import { CompareView } from "@/components/compare-view";

export const metadata: Metadata = {
  title: "Сравнение товаров",
  // Страница зависит от выбора в браузере — в поиске ей делать нечего.
  robots: { index: false, follow: false },
};

/*
  Сравнение целиком клиентское: выбранные товары лежат в localStorage
  (compare-store), поэтому серверу данные передавать не нужно.
*/
export default function ComparePage() {
  return <CompareView />;
}

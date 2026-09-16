import type { Metadata } from "next";
import { CompareView } from "@/components/compare-view";

export const metadata: Metadata = {
  title: "Сравнение товаров",
  // Страница зависит от выбора в браузере — в поиске ей делать нечего.
  robots: { index: false, follow: false },
};

/*
  Выбор хранится в браузере, характеристики запрашиваются из текущего каталога.
*/
export default function ComparePage() {
  return <CompareView />;
}

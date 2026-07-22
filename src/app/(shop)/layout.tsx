import { ShopChrome } from "@/components/shop-chrome";

/*
  Layout витрины. Вся обвязка — в ShopChrome: её же использует страница 404,
  которая лежит в корне приложения и группового layout не получает.
  Панель управления на /admin рисуется на чистом листе, без витрины вокруг.
*/
export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ShopChrome>{children}</ShopChrome>;
}

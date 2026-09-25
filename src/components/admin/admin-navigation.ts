import { BarChart3, BookOpen, Boxes, Building2, ClipboardList, FileClock, FileSpreadsheet, Headphones, Image, LayoutDashboard, MessageCircle, Newspaper, Package, Settings, ShoppingBag, Star, Tag, Users, type LucideIcon } from "lucide-react";

export type AdminNavigationItem = { href: string; label: string; icon: LucideIcon };
export const ADMIN_OVERVIEW: AdminNavigationItem = { href: "/admin", label: "Обзор", icon: LayoutDashboard };
export const ADMIN_NAV_GROUPS = [
  { id: "sales", label: "Продажи", items: [
    { href: "/admin/orders", label: "Заказы", icon: ShoppingBag },
    { href: "/admin/customers", label: "Клиенты", icon: Users },
    { href: "/admin/sales", label: "Отчёты", icon: BarChart3 },
    { href: "/admin/promos", label: "Промокоды", icon: Tag },
  ] },
  { id: "dealers", label: "Дилеры", items: [
    { href: "/admin/dealers", label: "Аккаунты и заявки", icon: Building2 },
    { href: "/admin/dealers/orders", label: "Заказы дилеров", icon: ClipboardList },
    { href: "/admin/dealer-prices", label: "Прайс", icon: FileSpreadsheet },
  ] },
  { id: "catalog", label: "Каталог", items: [
    { href: "/admin/inventory", label: "Остатки и резервы", icon: Boxes },
    { href: "/admin/products", label: "Товары", icon: Package },
    { href: "/admin/bundles", label: "Сборки", icon: Boxes },
    { href: "/admin/listening-stand", label: "Стенд", icon: Headphones },
  ] },
  { id: "content", label: "Контент", items: [
    { href: "/admin/news", label: "Новости", icon: Newspaper },
    { href: "/admin/banners", label: "Баннеры", icon: Image },
    { href: "/admin/support", label: "Материалы", icon: BookOpen },
  ] },
  { id: "feedback", label: "Обратная связь", items: [
    { href: "/admin/messages", label: "Чаты", icon: MessageCircle },
    { href: "/admin/reviews", label: "Отзывы", icon: Star },
  ] },
  { id: "system", label: "Система", items: [
    { href: "/admin/notifications", label: "Уведомления", icon: MessageCircle },
    { href: "/admin/settings", label: "Настройки", icon: Settings },
    { href: "/admin/audit", label: "Журнал", icon: FileClock },
  ] },
] satisfies Array<{ id: string; label: string; items: AdminNavigationItem[] }>;

export function currentAdminNavigation(pathname: string) {
  const matches = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ group, item })))
    .filter(({ item }) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.item.href.length - a.item.href.length);
  return matches[0] ?? { group: undefined, item: ADMIN_OVERVIEW };
}

import ClickSpark from "@/components/ui/ClickSpark";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { AuthModal } from "@/components/auth-modal";
import { Toaster } from "@/components/toaster";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { JsonLd } from "@/components/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import { YandexMetrica } from "@/components/yandex-metrica";
import { SiteConfigProvider } from "@/components/site-config-provider";
import { CustomerProvider } from "@/components/customer-provider";
import { getSiteConfig } from "@/lib/data";
import { currentCustomer } from "@/lib/customer-auth";
import { payConfig } from "@/lib/yandex-pay";

/*
  Обвязка витрины: шапка, футер, оверлеи, счётчик. Вынесена из layout группы
  `(shop)`, потому что нужна ещё и странице 404 — та живёт в корне приложения
  (ловит любые несуществующие адреса) и группового layout не получает.

  Контакты уходят клиентским компонентам через провайдер: конфиг читается
  с диска (его правят из админки), статическим импортом в браузер он больше
  не попадает.
*/
export async function ShopChrome({ children }: { children: React.ReactNode }) {
  const { contacts, trust } = getSiteConfig();
  // Кто вошёл — знает только сервер: кука подписана, в браузере её не проверить
  const customer = await currentCustomer();
  // В браузер уходит только «оплата работает / не работает». Ключи — никогда.
  const pay = payConfig();

  return (
    <SiteConfigProvider
      value={{
        contacts,
        trust,
        payEnabled: pay !== null,
        paySandbox: pay?.sandbox ?? false,
      }}
    >
      <CustomerProvider value={customer}>
      <YandexMetrica />
      {/* Разметка продавца и сайта для поисковиков — на всех страницах */}
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      {/*
        Колонка на всю высоту окна: если контента мало (короткая страница,
        пустой результат фильтра, высокий монитор), растягивается обёртка
        вокруг children, а тёмный футер остаётся прижатым к низу. Без этого
        под футером проступала светлая полоса фона body.
      */}
      <ClickSpark
        className="flex min-h-screen flex-col"
        sparkColor="#ff5500"
        sparkSize={11}
        sparkRadius={18}
        sparkCount={8}
        duration={450}
      >
        <AnnouncementBar />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </ClickSpark>
      {/*
        Оверлеи держим вне шапки и ClickSpark: у шапки backdrop-filter, а он
        создаёт точку отсчёта для position:fixed — внутри неё модалка
        позиционировалась бы относительно шапки, а не экрана (окно входа
        уезжало вверх на мобильном).
      */}
      <CartDrawer />
      <AuthModal />
      <Toaster />
      <WhatsAppFab />
      </CustomerProvider>
    </SiteConfigProvider>
  );
}

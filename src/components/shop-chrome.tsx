import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Overlays } from "@/components/overlays";
import { Toaster } from "@/components/toaster";
import { CookieNotice } from "@/components/cookie-notice";
import { CompareBar } from "@/components/compare-bar";
import { JsonLd } from "@/components/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import { YandexMetrica } from "@/components/yandex-metrica";
import { SiteConfigProvider } from "@/components/site-config-provider";
import { CustomerProvider } from "@/components/customer-provider";
import { SupportChatWidget } from "@/components/support-chat-widget";
import { getSiteConfig } from "@/lib/data";
import { payConfig } from "@/lib/yandex-pay";
import Script from "next/script";

/*
  Обвязка витрины: шапка, футер, оверлеи, счётчик. Вынесена из layout группы
  `(shop)`, потому что нужна ещё и странице 404 — та живёт в корне приложения
  (ловит любые несуществующие адреса) и группового layout не получает.

  Контакты уходят клиентским компонентам через провайдер: конфиг читается
  с диска (его правят из админки), статическим импортом в браузер он больше
  не попадает.
*/
export function ShopChrome({ children }: { children: React.ReactNode }) {
  const { contacts, trust, yandexMapsApiKey } = getSiteConfig();
  // В браузер уходит только «оплата работает / не работает». Ключи — никогда.
  const pay = payConfig();
  return (
    <SiteConfigProvider
      value={{
        contacts,
        trust,
        yandexMapsApiKey: yandexMapsApiKey || null,
        payEnabled: pay !== null,
        paySandbox: pay?.sandbox ?? false,
        payMerchantId: pay?.merchantId ?? null,
      }}
    >
      <CustomerProvider>
        {pay && (
          <Script
            id="yandex-pay-web-sdk"
            src="https://pay.yandex.ru/sdk/v1/pay.js"
            strategy="afterInteractive"
          />
        )}
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
        <div className="flex min-h-screen flex-col">
          <AnnouncementBar />
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        {/*
            Оверлеи держим вне шапки: у неё backdrop-filter, а он
            создаёт точку отсчёта для position:fixed — внутри неё модалка
            позиционировалась бы относительно шапки, а не экрана (окно входа
            уезжало вверх на мобильном).
        */}
        {/* Окно входа — отдельным куском, по требованию */}
        <Overlays />
        <Toaster />
        <SupportChatWidget />
        <CompareBar />
        <CookieNotice />
      </CustomerProvider>
    </SiteConfigProvider>
  );
}

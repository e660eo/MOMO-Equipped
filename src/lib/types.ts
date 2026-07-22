export interface Product {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  isClearance: boolean;
  /** true — есть на складе, false — под заказ; поля нет — статус неизвестен. */
  inStock?: boolean;
  /** Описание из прайса поставщика, построчно. */
  description?: string[];
  /**
   * Дополнительные фото для галереи (image остаётся обложкой).
   * Файлы лежат в папке данных (uploads/), загружаются через админку.
   */
  images?: string[];
  /** Снят с витрины из админки, но не удалён — карточки и ссылок нет. */
  hidden?: boolean;
}

export interface Category {
  slug: string;
  title: string;
  image: string;
  count: number;
}

export interface Brand {
  slug: string;
  title: string;
  house: boolean;
}

/** Готовая сборка: набор товаров с пакетной ценой. */
export interface Bundle {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  discountPercent: number;
  items: string[];
}

/** Сборка с подтянутыми товарами и посчитанной выгодой. */
export interface ResolvedBundle extends Omit<Bundle, "items"> {
  products: Product[];
  fullPrice: number;
  price: number;
  saving: number;
}

export interface NewsItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}

/** Контакты и цифры доверия — редактируются из админки. */
export interface SiteConfig {
  name: string;
  tagline: string;
  contacts: {
    phone: string;
    phoneSecondary: string;
    email: string;
    address: string;
    hours: string;
    whatsapp: string;
    telegram: string;
  };
  trust: {
    warrantyMonths: number;
    returnDays: number;
    processingDays: number;
    freeShippingFrom: number;
  };
  /** Юридические данные ИП. Из админки не правятся — только показ. */
  requisites: {
    fullName: string;
    shortName: string;
    inn: string;
    ogrnip: string;
    registrationAddress: string;
    postalAddress: string;
    bank: string;
    bik: string;
    correspondentAccount: string;
    settlementAccount: string;
    certificate: string;
    okpo: string;
    okato: string;
    oktmo: string;
    sfr: string;
    edoGuid: string;
    phones: string[];
    emails: string[];
    website: string;
    okvedMain: string;
    okvedExtra: string[];
  };
  /** Историческое поле: путь к фото задаётся в `format.ts`. */
  imageBase?: string;
}

/** Часть конфига, нужная клиентским компонентам (шапка, корзина, кнопки). */
export type PublicSiteConfig = Pick<SiteConfig, "contacts" | "trust">;

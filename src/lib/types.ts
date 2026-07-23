export interface Product {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  isClearance: boolean;
  /**
   * true — есть на складе, false — под заказ; поля нет — статус неизвестен.
   * При заданном `stock` не используется: наличие считается по остатку.
   */
  inStock?: boolean;
  /**
   * Остаток на складе, штук. Ноль — купить нельзя, только под заказ.
   * Покупателю число не показываем: это внутренний учёт.
   */
  stock?: number;
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
  /** Анонс: он же лид статьи и он же подпись в списке новостей. */
  excerpt: string;
  /**
   * Полный текст статьи. Обычный текст с разметкой в пару правил
   * (см. src/lib/article.ts) — не HTML: чужую разметку на своей странице
   * не исполняем.
   *
   * Поля нет — заметка остаётся анонсом, как три первые новости сайта.
   */
  body?: string;
}

/**
 * Покупатель с аккаунтом на сайте. Живёт в папке данных: внутри
 * персональные данные, поэтому файл не хранится в репозитории.
 */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  createdAt: string;
  lastLoginAt?: string;
  /** scrypt-хеш; наружу не отдаётся никогда. */
  passwordHash: string;
}

/** Клиент без хеша пароля — то, что можно показать в браузере. */
export type PublicCustomer = Omit<Customer, "passwordHash">;

/** Позиция заказа: цена фиксируется на момент оформления. */
export interface OrderItem {
  slug: string;
  title: string;
  price: number;
  qty: number;
}

export type OrderStatus = "new" | "in_work" | "done" | "canceled";

/*
  Состояние оплаты. Значения совпадают с paymentStatus Яндекс Пэй, плюс наши
  два: `none` — платёж не заводили (заказ через WhatsApp), `created` — ссылка
  выдана, но покупатель к форме ещё не подходил.

  Держим отдельно от OrderStatus: статус ведёт менеджер руками, оплату
  проставляет банк. Смешать их — значит однажды закрыть заказ как выполненный
  и потерять то, что деньги не пришли.
*/
export type PaymentStatus =
  | "none"
  | "created"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "VOIDED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export interface OrderPayment {
  status: PaymentStatus;
  /** Ссылка на платёжную форму — по ней покупателя можно вернуть к оплате. */
  url?: string;
  /**
   * Случайная метка для страницы «спасибо за оплату».
   *
   * Номер заказа (2207-001) перебирается за минуту, а на той странице
   * покупатель ждёт увидеть свой заказ. Без метки чужие заказы читались бы
   * простым перебором адреса.
   */
  token?: string;
  /** Сумма, на которую заведён платёж: она могла отличаться от суммы заказа. */
  amount: number;
  /** Когда состояние менялось в последний раз. */
  updatedAt: string;
  /** Песочница или боевой приём денег — чтобы тестовые не считались выручкой. */
  sandbox: boolean;
}

/**
 * Заказ с сайта. Хранится в папке данных, доступен только из панели:
 * внутри персональные данные покупателя.
 */
export interface Order {
  /** Короткий номер для разговора с покупателем: 2607-014. */
  id: string;
  createdAt: string;
  status: OrderStatus;
  customer: {
    name: string;
    phone: string;
    address: string;
    comment?: string;
  };
  items: OrderItem[];
  total: number;
  /** Заметка менеджера — видна только в панели. */
  note?: string;
  /** Заказ оформлен вошедшим покупателем — для истории в его кабинете. */
  customerId?: string;
  /** Онлайн-оплата. Поля нет — заказ оформлен без неё, через WhatsApp. */
  payment?: OrderPayment;
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
export type PublicSiteConfig = Pick<SiteConfig, "contacts" | "trust"> & {
  /**
   * Работает ли оплата на сайте. Только признак: ключи Яндекс Пэй в браузер
   * не попадают ни при каких условиях.
   */
  payEnabled: boolean;
  /** Оплата идёт в песочнице — предупреждаем, что деньги ненастоящие. */
  paySandbox: boolean;
};

export interface Product {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  isClearance: boolean;
  /** Свежая поставка: показываем бейдж и выводим товар в разделе новинок. */
  isNew?: boolean;
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
  /** SKU карточки товара в Ozon. Нужен только серверу для Ozon Доставки. */
  ozonSku?: number;
  /** Артикул продавца в Ozon; помогает сверять сопоставление в админке. */
  ozonOfferId?: string;
  /**
   * Профиль товара в онлайн-стенде. Запись публикуется только после явного
   * включения: загруженный черновик не должен случайно попасть покупателям.
   */
  listening?: {
    audio?: string;
    published?: boolean;
    highs?: number;
    mids?: number;
    lows?: number;
    volume?: number;
    note?: string;
  };
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

/**
 * Промокод: скидка в процентах с ограничением по числу активаций. Живёт в
 * папке данных, правится из панели.
 */
export interface Promo {
  /** Название-код (верхний регистр) — его вводит покупатель на оформлении. */
  code: string;
  /** Скидка в процентах, 1..100. */
  percent: number;
  /** Предел активаций; 0 — без ограничения. */
  limit: number;
  /** Сколько раз уже применён. */
  used: number;
  createdAt: string;
  /** Можно временно остановить промокод, не удаляя его и статистику. */
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
  minSubtotal?: number;
  maxDiscount?: number;
  productSlugs?: string[];
  categories?: string[];
  /** 0 или отсутствие поля — без ограничения на одного покупателя. */
  perCustomerLimit?: number;
  /** Активации по customerId или нормализованному телефону. */
  customerUses?: Record<string, number>;
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
  /** Email подтверждён переходом по одноразовой подписанной ссылке. */
  emailVerifiedAt?: string;
  /** Внутренние данные панели — покупателю не показываются. */
  admin?: {
    note?: string;
    tags?: string[];
    history?: Array<{ at: string; text: string }>;
  };
  /** scrypt-хеш; наружу не отдаётся никогда. */
  passwordHash: string;
}

/** Клиент без хеша пароля — то, что можно показать в браузере. */
export type PublicCustomer = Omit<Customer, "passwordHash" | "admin"> & {
  /** Доступные к списанию бонусы. Рассчитываются на сервере по журналу. */
  bonusBalance: number;
  /** Ближайшая дата сгорания неиспользованных бонусов. */
  bonusExpiresAt?: string;
};

export type BonusTransactionType =
  | "admin_credit"
  | "admin_debit"
  | "order_spend"
  | "order_return";

/** Неизменяемая операция бонусного счёта. Положительная сумма — начисление. */
export interface BonusTransaction {
  id: string;
  customerId: string;
  type: BonusTransactionType;
  amount: number;
  createdAt: string;
  expiresAt?: string;
  reason: string;
  actor: string;
  orderId?: string;
  /** Корневая операция списания, чтобы отмена и повторное открытие были идемпотентны. */
  relatedId?: string;
}

/** Позиция заказа: цена фиксируется на момент оформления. */
export interface OrderItem {
  slug: string;
  title: string;
  price: number;
  qty: number;
}

export type OrderStatus = "new" | "in_work" | "done" | "canceled";

export interface OrderHistoryEntry {
  at: string;
  actor: string;
  type: "created" | "status" | "note" | "payment" | "delivery" | "bonus" | "notification" | "receipt";
  from?: string;
  to?: string;
  detail?: string;
}

export interface OrderFiscalReceipt {
  provider: "yandex_pay";
  /**
   * Yandex Pay подтверждает приём реквизитов чека, но Merchant API не отдаёт
   * номер фискального документа и факт доставки письма ОФД.
   */
  status: "submitted" | "payment_confirmed" | "error";
  contact: string;
  submittedAt: string;
  checkedAt?: string;
  /** Идентификатор платёжной операции — не номер кассового чека. */
  operationId?: string;
  operationStatus?: "PENDING" | "SUCCESS" | "FAIL";
  payloadConfirmed?: boolean;
  error?: string;
}

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
  /** Контроль передачи данных для электронного фискального чека. */
  receipt?: OrderFiscalReceipt;
}

export interface OzonDeliverySplit {
  /** Магазин всегда передаёт заказ со своего склада — FBO здесь запрещён. */
  deliverySchema: "FBS";
  warehouseId: number;
  deliveryMethod: {
    id: number;
    type: "PVZ" | "POSTAMAT" | "COURIER";
    timeslotId: number;
    logisticFrom: string;
    logisticTo: string;
  };
  items: Array<{ slug: string; sku: number; offerId?: string; quantity: number }>;
}

export interface OrderDelivery {
  provider: "ozon";
  type: "pickup";
  mapPointId: number;
  pointName: string;
  address: string;
  /** Цена доставки для покупателя. */
  customerPrice: number;
  estimatedFrom?: string;
  estimatedTo?: string;
  splits: OzonDeliverySplit[];
  shipment?: {
    status: "creating" | "created" | "failed";
    attemptedAt: string;
    orderNumber?: string;
    postings?: string[];
    error?: string;
  };
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
    /** Email аккаунта — используется кассой для отправки фискального чека. */
    email?: string;
    phone: string;
    address: string;
    comment?: string;
  };
  items: OrderItem[];
  /** Итог к оплате — после промокода и бонусов, с платной доставкой. */
  total: number;
  /** Применённый промокод: код, процент и сумма скидки в рублях. */
  promo?: { code: string; percent: number; discount: number };
  /** Бонусы списываются только со стоимости товаров, не с доставки. */
  bonus?: { spent: number; transactionId: string };
  /** Заметка менеджера — видна только в панели. */
  note?: string;
  /**
   * Списан ли остаток по этому заказу. Остаток уходит при переводе заказа в
   * «в работе»/«выполнен» и возвращается при откате в «новый»/«отменён»; флаг
   * не даёт списать или вернуть дважды.
   */
  stockDeducted?: boolean;
  /** Заказ оформлен вошедшим покупателем — для истории в его кабинете. */
  customerId?: string;
  /**
   * Покупатель выбрал онлайн-оплату. Запись видна менеджеру сразу, а статус
   * платежа автоматически сверяется с Яндекс Пэй до терминального состояния.
   */
  paymentRequested?: boolean;
  /** Онлайн-оплата. Поля нет — заказ оформлен без неё, через WhatsApp. */
  payment?: OrderPayment;
  /** Выбранный и проверенный сервером вариант Ozon Доставки. */
  delivery?: OrderDelivery;
  /** Неизменяемая хронология важных действий над заказом. */
  history?: OrderHistoryEntry[];
}

export type AuditEntity = "product" | "order" | "promo" | "customer" | "settings" | "integration" | "dealer" | "support";

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: string;
  entity: AuditEntity;
  entityId: string;
  action: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface DeletedProduct {
  product: Product;
  deletedAt: string;
  purgeAfter: string;
}

/* ------------------------------- B2B ----------------------------------- */

/** Публичная карточка официального дилера. Закрытых цен и данных входа здесь нет. */
export interface DealerLocation {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  hours?: string;
  latitude?: number;
  longitude?: number;
  /** Точка выполняет авторизованную установку с расширенной гарантией. */
  authorizedInstallation?: boolean;
  /** Точка опубликована в разделе «Купить рядом». */
  active: boolean;
  createdAt: string;
}

/** Уровень закрытых цен, назначаемый партнёру администратором. */
export type DealerPriceTier = "dealer" | "dagestan" | "wholesale";

/** Закрытая учётная запись дилера. Читается только на сервере. */
export interface DealerAccount {
  id: string;
  dealerId: string;
  contactName: string;
  email: string;
  passwordHash: string;
  /** Для старых аккаунтов без поля используется дилерский прайс. */
  priceTier?: DealerPriceTier;
  discountPercent: number;
  /** Исключения из общей скидки: точная цена по slug товара. */
  priceOverrides?: Record<string, number>;
  createdAt: string;
  activatedAt?: string;
  lastLoginAt?: string;
  disabled?: boolean;
  inviteHash?: string;
  inviteExpiresAt?: string;
  lastAccessMailAt?: string;
  lastAccessMailError?: string;
}

export type DealerApplicationStatus = "new" | "in_work" | "approved" | "rejected";

export interface DealerApplication {
  id: string;
  createdAt: string;
  company: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: "store" | "install" | "online" | "mixed";
  website?: string;
  comment?: string;
  status: DealerApplicationStatus;
  note?: string;
}

export type DealerOrderStatus = "new" | "confirmed" | "shipped" | "done" | "canceled";

export interface DealerOrder {
  id: string;
  dealerId: string;
  accountId: string;
  createdAt: string;
  status: DealerOrderStatus;
  items: OrderItem[];
  total: number;
  comment?: string;
  history: Array<{ at: string; actor: string; from?: string; to: string }>;
}

export type SupportDocumentCategory =
  | "instruction"
  | "scheme"
  | "certificate"
  | "warranty"
  | "catalog"
  | "marketing";

export interface SupportDocument {
  id: string;
  title: string;
  description?: string;
  category: SupportDocumentCategory;
  audience: "public" | "dealer";
  file: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  productSlugs?: string[];
}

export type IntegrationJobType =
  | "ozon_shipment"
  | "order_mail"
  | "customer_payment_mail"
  | "customer_welcome"
  | "customer_email_verification"
  | "fiscal_check";

export interface IntegrationJob {
  id: string;
  type: IntegrationJobType;
  entityId: string;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  runAt: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  lastResult?: string;
  payload?: Record<string, string>;
}

/** Контакты и цифры доверия — редактируются из админки. */
export interface SiteConfig {
  name: string;
  tagline: string;
  /** Публичный ключ JavaScript API Яндекс Карт, ограниченный доменом сайта. */
  yandexMapsApiKey?: string;
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
    extendedWarrantyMonths: number;
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
  /** Публичный ключ подложки Яндекс Карты; доступ к заказам он не даёт. */
  yandexMapsApiKey: string | null;
  /**
   * Работает ли оплата на сайте. Только признак: ключи Яндекс Пэй в браузер
   * не попадают ни при каких условиях.
   */
  payEnabled: boolean;
  /** Оплата идёт в песочнице — предупреждаем, что деньги ненастоящие. */
  paySandbox: boolean;
  /**
   * Публичный идентификатор магазина для Web SDK и официальных бейджей.
   * Это не API-ключ: право создавать платежи по-прежнему остаётся на сервере.
   */
  payMerchantId: string | null;
};

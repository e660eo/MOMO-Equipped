export interface Product {
  slug: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  isClearance: boolean;
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

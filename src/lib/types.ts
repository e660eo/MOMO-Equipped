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

export interface NewsItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}

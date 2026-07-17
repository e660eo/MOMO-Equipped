import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Фото товаров пока грузятся напрямую со старого сайта (см. ProductImage).
  // После переезда в CMS (Фаза 2) фото будут на своём CDN.
};

export default nextConfig;

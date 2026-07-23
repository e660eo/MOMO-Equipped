import type { NextConfig } from "next";

/*
  Версия сборки приходит переменной окружения BUILD_REVISION — её ставит
  scripts/deploy.sh перед сборкой. Раньше конфиг сам вызывал `git rev-parse`,
  но любые обращения к файловой системе отсюда заставляют сборщик тянуть в
  трассировку весь проект (предупреждение «unexpected file in NFT list»).
*/
const nextConfig: NextConfig = {
  env: {
    BUILD_REVISION: process.env.BUILD_REVISION ?? "dev",
    BUILD_TIME: new Date().toISOString(),
  },
  // nodemailer — обычный CommonJS-пакет для Node: пусть сборщик его не трогает,
  // а требует из node_modules как есть.
  serverExternalPackages: ["nodemailer"],

  /*
    Заголовки безопасности. Раньше не отдавался ни один.

    CSP здесь намеренно нет: на страницах есть встроенные скрипты (разметка
    Schema.org, загрузчик Метрики) и стили, а снаружи подключаются Метрика и
    карты Яндекса. Политику под это нужно собирать с nonce и списком
    источников и проверять по всему сайту — отдельная работа, а не строчка
    в конфиге. Полумера вида unsafe-inline не защищает ни от чего.
  */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Форму входа и подтверждение заказа нельзя затянуть в чужой iframe.
          // Карты Яндекса это не задевает: заголовок про нас в чужой рамке,
          // а не про чужое внутри нас.
          { key: "X-Frame-Options", value: "DENY" },
          // Браузер не додумывает тип файла за сервером.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Наружу уходит только домен, без пути: адреса кабинета и страницы
          // возврата с оплаты содержат номер заказа и метку.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Ничего из этого сайт не использует — пусть и не сможет.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          /*
            HSTS на два года. Nginx и так уводит с http на https, но 301
            выполняется уже после запроса — заголовок избавляет от самого
            первого незащищённого захода.

            includeSubDomains — сертификат выпущен на momo-eq.ru и www,
            других поддоменов нет. preload не ставим: попадание в списки
            браузеров отменяется месяцами.
          */
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

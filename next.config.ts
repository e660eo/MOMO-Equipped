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
};

export default nextConfig;

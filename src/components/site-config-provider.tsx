"use client";

import { createContext, useContext } from "react";
import type { PublicSiteConfig } from "@/lib/types";

/*
  Контакты для клиентских компонентов.

  Раньше они импортировали site.json напрямую, но теперь конфиг читается
  с диска в рантайме (его правят из админки), и статический импорт в браузер
  уйти не может. Серверный layout читает файл и кладёт значения сюда.
*/

const SiteConfigContext = createContext<PublicSiteConfig | null>(null);

export function SiteConfigProvider({
  value,
  children,
}: {
  value: PublicSiteConfig;
  children: React.ReactNode;
}) {
  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig(): PublicSiteConfig {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) {
    throw new Error("useSiteConfig вызван вне SiteConfigProvider");
  }
  return ctx;
}

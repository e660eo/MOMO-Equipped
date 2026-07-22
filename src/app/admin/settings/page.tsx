import Link from "next/link";
import { getSiteConfig } from "@/lib/data";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();

  const { saved } = await searchParams;
  const site = getSiteConfig();

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">
        Контакты и условия
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Эти данные подставляются по всему сайту: шапка, футер, корзина,
        страницы доставки и контактов.
      </p>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      <div className="mt-7">
        <SettingsForm site={site} />
      </div>

      <p className="mt-10 max-w-[680px] rounded-sm border border-border bg-surface px-4 py-3 text-[0.82rem] text-muted-foreground">
        Реквизиты ИП (ИНН, ОГРНИП, счёт в банке) здесь не меняются — они уходят
        в договоры и счета, ошибка там дороже удобства. Понадобится правка —
        напишите разработчику, страница{" "}
        <Link href="/requisites" target="_blank" className="text-signal">
          «Реквизиты»
        </Link>{" "}
        обновится вместе с кодом.
      </p>
    </div>
  );
}

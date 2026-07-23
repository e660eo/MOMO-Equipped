import Link from "next/link";
import { getSiteConfig } from "@/lib/data";
import { SettingsForm } from "@/components/admin/settings-form";
import {
  MailStatusPanel,
  type MailStatus,
} from "@/components/admin/mail-status";
import { PayStatusPanel, type PayStatus } from "@/components/admin/pay-status";
import { requireAdminPage } from "@/lib/admin-auth";
import { mailerConfig, lastMailResult } from "@/lib/mailer";
import { payConfig } from "@/lib/yandex-pay";
import { SITE_URL } from "@/lib/site-url";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();

  const { saved } = await searchParams;
  const site = getSiteConfig();

  // Настройки почты не отдаём в браузер целиком: там логин ящика.
  const mail = mailerConfig();
  const last = lastMailResult();
  // Из настроек оплаты наружу отдаём только «включено» и «песочница».
  const pay = payConfig();
  const payStatus: PayStatus = {
    configured: pay !== null,
    sandbox: pay?.sandbox ?? false,
    callbackUrl: `${SITE_URL}/api/pay/callback`,
  };

  const mailStatus: MailStatus = {
    configured: Boolean(mail),
    to: mail?.to ?? [],
    host: mail?.host ?? "",
    last: last
      ? {
          ok: last.ok,
          at: last.at,
          detail: last.ok ? "" : last.error,
        }
      : null,
  };

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

      <div className="mt-10">
        <MailStatusPanel status={mailStatus} />
      </div>

      <div className="mt-6">
        <PayStatusPanel status={payStatus} />
      </div>

      <p className="mt-6 max-w-[680px] rounded-sm border border-border bg-surface px-4 py-3 text-[0.82rem] text-muted-foreground">
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

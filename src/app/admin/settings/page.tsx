import Link from "next/link";
import { getSiteConfig } from "@/lib/data";
import { SettingsForm } from "@/components/admin/settings-form";
import {
  MailStatusPanel,
  type MailStatus,
} from "@/components/admin/mail-status";
import { PayStatusPanel, type PayStatus } from "@/components/admin/pay-status";
import { HealthPanel } from "@/components/admin/health-panel";
import { requireAdminPage } from "@/lib/admin-auth";
import { mailerConfig, lastMailResult } from "@/lib/mailer";
import { isFiscalEnabled, payConfig } from "@/lib/yandex-pay";
import { getHealthReport } from "@/lib/health";
import { SITE_URL } from "@/lib/site-url";
import { getIntegrationJobs } from "@/lib/job-queue";
import { getOzonStockSyncStatus } from "@/lib/ozon-stock";
import { OzonStockCredentialsForm } from "@/components/admin/ozon-stock-credentials-form";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; ozonSaved?: string }>;
}) {
  await requireAdminPage();

  const { saved, ozonSaved } = await searchParams;
  const site = getSiteConfig();

  // Настройки почты не отдаём в браузер целиком: там логин ящика.
  const mail = mailerConfig();
  const last = lastMailResult();
  // Из настроек оплаты наружу отдаём только «включено» и «песочница».
  const pay = payConfig();
  const payStatus: PayStatus = {
    configured: pay !== null,
    sandbox: pay?.sandbox ?? false,
    fiscal: isFiscalEnabled(),
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

  const health = await getHealthReport();
  const jobs = getIntegrationJobs(20);
  const ozonStock = getOzonStockSyncStatus();

  return (
    <div>
      <h1 className="font-display text-xl font-extrabold uppercase">
        Настройки
      </h1>
      <p className="mt-1 text-[0.85rem] text-muted-foreground">
        Контакты, условия продажи, интеграции, уведомления и состояние системы.
      </p>

      {saved && (
        <p className="mt-4 rounded-sm border border-border bg-surface px-4 py-2.5 text-[0.85rem]">
          Сохранено. Изменения уже на сайте.
        </p>
      )}

      <nav className="mt-5 flex flex-wrap gap-2 text-[0.8rem]">
        {[ ["contacts", "Контакты"], ["delivery", "Доставка"], ["payment", "Оплата"], ["integrations", "Интеграции"], ["notifications", "Уведомления"], ["health", "Состояние системы"] ].map(([id, title]) => <a key={id} href={`#${id}`} className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-signal hover:text-signal">{title}</a>)}
      </nav>

      <section id="contacts" className="mt-7 scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Контакты и условия</h2>
        <p className="mt-1 text-[0.78rem] text-muted-foreground">Телефоны, адрес, гарантии, возврат и порог бесплатной доставки.</p>
        <div className="mt-5">
        <SettingsForm site={site} />
        </div>
      </section>

      <section id="notifications" className="mt-6 scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Уведомления</h2>
        <p className="mt-1 text-[0.78rem] text-muted-foreground">Письма о заказах и автоматические предупреждения об остатках и ошибках отправляются на настроенную почту.</p>
        <div className="mt-5">
        <MailStatusPanel status={mailStatus} />
        </div>
      </section>

      <section id="payment" className="mt-6 scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Оплата</h2>
        <div className="mt-5">
        <PayStatusPanel status={payStatus} />
        </div>
      </section>

      <section id="integrations" className="mt-6 scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Интеграции и фоновая очередь</h2>
        <p className="mt-1 text-[0.78rem] text-muted-foreground">Ozon и почта повторяются автоматически при временной ошибке.</p>
        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-[0.85rem] font-semibold">Остатки склада MOMO → Ozon</p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-muted-foreground">
              {ozonStock.configured
                ? `Доступ подготовлен (${ozonStock.credentialSource === "encrypted_file" ? "Seller API · ключ зашифрован" : ozonStock.authMode === "api_key" ? "Seller API · окружение сервера" : "OAuth"}); ${ozonStock.warehouseMode === "fixed" ? `склад ${ozonStock.warehouseId}` : "единственный активный FBS-склад определяется автоматически"}.`
                : "Нет доступа к управлению остатками. Добавьте Seller API-ключ или подключите OAuth Ozon."}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[0.75rem] font-semibold ${ozonStock.configured ? "border-green-600/40 text-green-700 dark:text-green-400" : "border-border text-muted-foreground"}`}>
            {ozonStock.configured ? "Готово к проверке" : "Не настроено"}
          </span>
        </div>
        {ozonSaved && (
          <p role="status" className="mt-4 rounded-sm border border-green-600/35 px-4 py-3 text-[0.82rem] text-green-700 dark:text-green-400">
            Ключи Ozon зашифрованы и сохранены. Теперь сайт сможет обновлять остатки перед расчётом доставки.
          </p>
        )}
        <OzonStockCredentialsForm configured={ozonStock.authMode === "api_key"} canSave={ozonStock.canSaveInAdmin} />
        <p className="mt-5 text-[0.78rem] text-muted-foreground">Последние фоновые задачи:</p>
        {jobs.length === 0 ? <p className="mt-4 text-[0.82rem] text-muted-foreground">Очередь пока не использовалась.</p> : <div className="mt-4 grid gap-2">{jobs.map((job) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2 text-[0.78rem]"><span><b>{job.type === "ozon_shipment" ? "Ozon" : "Почта"}</b> · заказ {job.entityId}</span><span className={job.status === "failed" ? "text-signal" : "text-muted-foreground"}>{job.status} · попыток {job.attempts}{job.lastError ? ` · ${job.lastError}` : ""}</span></div>)}</div>}
      </section>

      <section id="health" className="mt-6 scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-extrabold uppercase">Состояние системы</h2>
        <div className="mt-5">
        <HealthPanel report={health} endpoint={`${SITE_URL}/api/health`} />
        </div>
      </section>

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

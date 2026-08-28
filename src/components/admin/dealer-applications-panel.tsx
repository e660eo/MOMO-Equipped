import Link from "next/link";
import { Archive, ArchiveRestore, FileCheck2 } from "lucide-react";
import {
  archiveDealerApplicationAction,
  deleteDealerApplicationAction,
  restoreDealerApplicationAction,
  setDealerApplicationStatus,
} from "@/app/admin/dealers/actions";
import type { DealerApplication } from "@/lib/types";
import { ConfirmButton } from "./confirm-button";

const APP_LABELS = {
  new: "Новая",
  in_work: "В работе",
  approved: "Одобрена",
  rejected: "Отклонена",
} as const;

const BUSINESS_LABELS = {
  store: "Магазин",
  install: "Студия установки",
  online: "Интернет-магазин",
  mixed: "Несколько направлений",
} as const;

const inputClass = "h-11 rounded-md border border-border bg-white px-3 text-sm";

function ApplicationDetails({ application }: { application: DealerApplication }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal">
            {BUSINESS_LABELS[application.businessType]}
          </p>
          <h3 className="mt-1 break-words font-bold">{application.company}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {application.city} · {application.contactName}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-1 text-xs">
            <a className="hover:text-signal" href={`tel:${application.phone}`}>{application.phone}</a>
            <span aria-hidden>·</span>
            <a className="break-all hover:text-signal" href={`mailto:${application.email}`}>{application.email}</a>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold">
          {APP_LABELS[application.status]}
        </span>
      </div>
      {application.comment && (
        <p className="mt-3 rounded-md bg-black/[.025] p-2 text-xs leading-5 text-muted-foreground">
          {application.comment}
        </p>
      )}
    </>
  );
}

export function DealerApplicationsPanel({ applications }: { applications: DealerApplication[] }) {
  const activeApplications = applications.filter((application) => !application.archivedAt);
  const archivedApplications = applications.filter((application) => application.archivedAt);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <FileCheck2 className="text-signal" size={21} aria-hidden />
        <div>
          <h2 className="font-display text-lg font-extrabold uppercase">Заявки</h2>
          <p className="text-xs text-muted-foreground">
            Активных: {activeApplications.length} · в архиве: {archivedApplications.length}
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-[660px] space-y-3 overflow-auto pr-1">
        {activeApplications.map((application) => (
          <article key={application.id} className="rounded-lg border border-border p-4">
            <ApplicationDetails application={application} />
            <div className="mt-3 grid gap-2 min-[440px]:grid-cols-[auto_minmax(0,1fr)]">
              <Link
                href={`/admin/dealers?application=${application.id}#create`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-signal px-3 py-2 text-xs font-bold text-white"
              >
                Одобрить и создать
              </Link>
              <form action={setDealerApplicationStatus} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input type="hidden" name="id" value={application.id} />
                <label className="sr-only" htmlFor={`application-status-${application.id}`}>Статус заявки</label>
                <select
                  id={`application-status-${application.id}`}
                  className={`${inputClass} min-w-0 w-full`}
                  name="status"
                  defaultValue={application.status}
                >
                  <option value="new">Новая</option>
                  <option value="in_work">В работе</option>
                  <option value="approved">Одобрена</option>
                  <option value="rejected">Отклонена</option>
                </select>
                <button className="min-h-11 rounded-md border border-border px-3 text-xs font-bold">Сохранить</button>
              </form>
            </div>
            <form action={archiveDealerApplicationAction} className="mt-3 border-t border-border pt-2">
              <input type="hidden" name="id" value={application.id} />
              <button className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
                <Archive size={15} aria-hidden />
                Переместить в архив
              </button>
            </form>
          </article>
        ))}
        {!activeApplications.length && (
          <p className="rounded-lg bg-black/[.025] p-6 text-center text-sm text-muted-foreground">
            Активных заявок нет. Новые заявки со страницы «Стать дилером» появятся здесь.
          </p>
        )}
      </div>

      <details className="mt-5 border-t border-border pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
          <span className="inline-flex items-center gap-2"><Archive size={17} aria-hidden /> Архив заявок</span>
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs">{archivedApplications.length}</span>
        </summary>
        <div className="mt-3 space-y-3">
          {archivedApplications.map((application) => (
            <article key={application.id} className="rounded-lg border border-dashed border-border bg-black/[.015] p-4">
              <ApplicationDetails application={application} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                В архиве с {new Date(application.archivedAt!).toLocaleString("ru-RU")}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2">
                <form action={restoreDealerApplicationAction}>
                  <input type="hidden" name="id" value={application.id} />
                  <button className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-signal">
                    <ArchiveRestore size={15} aria-hidden />
                    Восстановить
                  </button>
                </form>
                <form action={deleteDealerApplicationAction}>
                  <input type="hidden" name="id" value={application.id} />
                  <ConfirmButton
                    label="Удалить навсегда"
                    question={`Окончательно удалить заявку «${application.company}»? Вернуть её после удаления будет нельзя.`}
                  />
                </form>
              </div>
            </article>
          ))}
          {!archivedApplications.length && (
            <p className="rounded-lg bg-black/[.025] p-5 text-center text-sm text-muted-foreground">
              Архив пока пуст.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

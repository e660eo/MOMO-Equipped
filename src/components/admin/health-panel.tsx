import type { HealthReport, HealthLevel } from "@/lib/health";

/*
  Блок состояния сайта в панели: те же проверки, что видит внешний монитор,
  но человеческими словами и с деталями (пути, цифры диска) — их наружу без
  ключа не отдают. Серверный компонент: интерактива нет, только показ.
*/

const dotClass: Record<HealthLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HealthPanel({
  report,
  endpoint,
}: {
  report: HealthReport;
  endpoint: string;
}) {
  return (
    <section className="max-w-[680px] rounded-sm border border-border bg-surface p-5">
      <h2 className="font-display text-base font-extrabold uppercase">
        Состояние сайта
      </h2>

      <ul className="mt-3 space-y-2.5">
        {report.checks.map((c) => (
          <li key={c.id} className="flex gap-2.5 text-[0.85rem] leading-relaxed">
            <span
              className={`mt-[0.4rem] h-2 w-2 shrink-0 rounded-full ${dotClass[c.level]}`}
              aria-hidden
            />
            <span>
              <b className="font-semibold">{c.label}.</b> {c.detail}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
        Проверено в {when(report.checkedAt)}. Эти же проверки отдаёт адрес{" "}
        <code className="font-mono text-[0.8rem]">{endpoint}</code> внешнему
        монитору доступности. Он опрашивает сайт со стороны и пишет владельцу,
        если сайт совсем не отвечает, — то, что встроенная проверка поймать не
        может (мёртвый процесс молчит). Настройка монитора — в DEPLOY.md, раздел
        «Мониторинг доступности».
      </p>
    </section>
  );
}

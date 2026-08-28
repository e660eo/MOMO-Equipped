import Link from "next/link";

export function SectionHead({
  title,
  eyebrow,
  linkHref,
  linkLabel,
}: {
  title: string;
  eyebrow?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-col items-start gap-2 sm:mb-11 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2.5 inline-flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground before:h-px before:w-6 before:bg-signal before:content-['']">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-semibold uppercase leading-[1.05]">
          {title}
        </h2>
      </div>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          // min-h-11 — область нажатия пальцем; строка в 19px для этого мала
          className="inline-flex min-h-11 max-w-full items-center font-mono text-[0.72rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-signal sm:shrink-0 sm:whitespace-nowrap sm:text-[0.78rem]"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

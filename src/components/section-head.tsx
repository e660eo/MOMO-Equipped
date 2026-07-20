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
    <div className="mb-11 flex items-end justify-between gap-5">
      <div>
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
          className="whitespace-nowrap font-mono text-[0.78rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-signal"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

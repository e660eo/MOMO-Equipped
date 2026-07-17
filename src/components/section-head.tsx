import Link from "next/link";

export function SectionHead({
  title,
  linkHref,
  linkLabel,
}: {
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-11 flex items-baseline justify-between gap-5">
      <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-medium uppercase">
        {title}
      </h2>
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

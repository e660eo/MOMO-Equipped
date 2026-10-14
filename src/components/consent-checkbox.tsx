import Link from "next/link";
import { CONSENT_VERSION, type ConsentPurpose } from "@/lib/privacy-documents";

export function ConsentCheckbox({ id, purpose = "order", checked, onChange, className = "", ariaInvalid, ariaDescribedBy }: {
  id: string;
  purpose?: ConsentPurpose;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  className?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  return (
    <div className={"flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground " + className}>
      <input type="hidden" name="consentVersion" value={CONSENT_VERSION} />
      <input id={id} name="consent" type="checkbox" required
        aria-label={purpose === "review" ? "Согласие на распространение данных в отзыве" : "Согласие на обработку персональных данных"}
        aria-invalid={ariaInvalid || undefined} aria-describedby={ariaDescribedBy}
        {...(onChange ? { checked, onChange: (e) => onChange(e.target.checked) } : {})}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#FF5500]" />
      <span>
        <label htmlFor={id} className="cursor-pointer">
          {purpose === "review" ? "Разрешаю публикацию данных из моего отзыва согласно " : "Даю "}
        </label>
        <Link href={"/consent/" + purpose} target="_blank" rel="noopener noreferrer" className="text-[var(--signal-text)] underline underline-offset-2">
          {purpose === "review" ? "отдельному согласию на распространение" : "отдельное согласие на обработку персональных данных"}
        </Link>.
        <span className="mt-1 block">О целях и сроках обработки — в <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">политике</Link>.</span>
      </span>
    </div>
  );
}

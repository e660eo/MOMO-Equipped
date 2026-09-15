"use client";

import { useState, useTransition } from "react";
import { sendCustomerVerificationEmail } from "@/app/admin/customers/actions";

export function VerificationEmailButton({
  customerId,
  email,
  verifiedAt,
}: {
  customerId: string;
  email: string;
  verifiedAt?: string;
}) {
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  if (verifiedAt) {
    return (
      <span className="text-[0.72rem] font-medium text-green-700">
        Почта подтверждена
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult({});
          start(async () => setResult(await sendCustomerVerificationEmail(customerId)));
        }}
        className="min-h-11 rounded-sm border border-signal px-3 py-2 text-[0.78rem] font-semibold text-signal transition-all hover:bg-signal hover:text-white active:scale-95 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Отправляю…" : "Отправить подтверждение"}
      </button>
      <span className="max-w-sm break-words text-[0.7rem] text-muted-foreground">
        На {email}
      </span>
      {result.ok && (
        <span role="status" className="max-w-sm text-[0.72rem] text-green-700">
          {result.ok}
        </span>
      )}
      {result.error && (
        <span role="alert" className="max-w-sm text-[0.72rem] text-[var(--signal-text)]">
          {result.error}
        </span>
      )}
    </span>
  );
}

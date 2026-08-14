import Link from "next/link";
import { confirmEmailByToken } from "@/app/customer-actions";

export const metadata = {
  title: "Подтверждение почты · MOMO",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const ok = await confirmEmailByToken(token ?? "");

  return (
    <main className="mx-auto flex min-h-[56vh] max-w-[720px] items-center px-4 py-16 sm:px-6">
      <section className="w-full rounded-2xl border border-border bg-surface p-7 text-center sm:p-10">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-signal">Личный кабинет</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold uppercase">
          {ok ? "Почта подтверждена" : "Ссылка не сработала"}
        </h1>
        <p className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed text-muted-foreground">
          {ok
            ? "Теперь адрес подтверждён, и вы можете оплачивать заказы на сайте."
            : "Ссылка истекла или была повреждена. Войдите в кабинет и запросите новое письмо."}
        </p>
        <Link href="/profile" className="mt-6 inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white">
          Открыть личный кабинет
        </Link>
      </section>
    </main>
  );
}

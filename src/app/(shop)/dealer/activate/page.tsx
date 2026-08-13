import type { Metadata } from "next";
import Link from "next/link";
import { DealerAuthForm } from "@/components/dealer-auth-form";
import { accountForInvite } from "@/lib/dealers";

export const metadata: Metadata = { title: "Активация кабинета дилера", robots: { index: false, follow: false } };

export default async function DealerActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const account = token ? accountForInvite(token) : undefined;
  return <main className="mx-auto grid min-h-[74vh] max-w-[1180px] place-items-center px-5 py-16"><section className="w-full max-w-[480px] rounded-[28px] border border-black/8 bg-white p-7 shadow-[0_30px_80px_rgba(0,0,0,.08)] sm:p-10">{account ? <><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff5500]">Первый вход</p><h1 className="mt-3 font-display text-4xl font-black uppercase tracking-[-.04em]">Задайте пароль</h1><p className="mt-3 text-sm leading-6 text-black/55">Доступ создан для <b>{account.contactName}</b>. Ссылка одноразовая и действует 72 часа.</p><DealerAuthForm mode="activate" token={token} /></> : <><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff5500]">Ссылка недействительна</p><h1 className="mt-3 font-display text-3xl font-black uppercase tracking-[-.04em]">Нужна новая ссылка</h1><p className="mt-4 text-sm leading-6 text-black/55">Ссылка могла истечь или уже использована. Попросите менеджера повторно выдать доступ.</p><Link className="mt-7 inline-flex h-11 items-center rounded-lg bg-black px-5 text-sm font-bold text-white" href="/contacts">Связаться с нами</Link></>}</section></main>;
}

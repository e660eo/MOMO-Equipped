import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DealerLoginPrompt } from "@/components/dealer-login-prompt";
import { currentDealer } from "@/lib/dealer-auth";

export const metadata: Metadata = { title: "Вход для дилеров", robots: { index: false, follow: false } };

export default async function DealerLoginPage() {
  if (await currentDealer()) redirect("/dealer");
  return <main className="mx-auto grid min-h-[74vh] max-w-[1180px] place-items-center px-5 py-16"><section className="w-full max-w-[460px] rounded-[28px] border border-black/8 bg-white p-7 shadow-[0_30px_80px_rgba(0,0,0,.08)] sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff5500]">MOMO / ZEUS · B2B</p><h1 className="mt-3 font-display text-4xl font-black uppercase tracking-[-.04em]">Кабинет дилера</h1><p className="mt-3 text-sm leading-6 text-black/55">Теперь отдельной формы нет. Войдите через обычный личный кабинет в шапке, используя дилерские email и пароль — сайт сам откроет закрытые цены, остатки, заказы и материалы.</p><DealerLoginPrompt /><p className="mt-6 text-center text-xs leading-5 text-black/45">Доступ выдаёт менеджер после одобрения заявки.<br /><Link className="font-semibold text-[#ff5500] hover:underline" href="/become-dealer">Стать дилером</Link></p></section></main>;
}

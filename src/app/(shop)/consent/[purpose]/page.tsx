import { notFound } from "next/navigation";
import Link from "next/link";
import { CONSENT_PURPOSES, consentDocument, type ConsentPurpose } from "@/lib/privacy-documents";

export const metadata = { title: "Отдельное согласие · MOMO", robots: { index: false, follow: true } };
export function generateStaticParams() { return CONSENT_PURPOSES.map(purpose => ({ purpose })); }
export default async function ConsentPage({ params }: { params: Promise<{ purpose: string }> }) {
  const { purpose } = await params;
  if (!CONSENT_PURPOSES.includes(purpose as ConsentPurpose)) notFound();
  const document = consentDocument(purpose as ConsentPurpose);
  return <main className="mx-auto max-w-[840px] px-4 py-12 sm:px-6">
    <h1 className="font-display text-2xl font-bold">{document.title}</h1>
    <div className="mt-6 space-y-5 text-base leading-relaxed">{document.paragraphs.map((text, i) => <p key={i}>{text}</p>)}</div>
    <Link href="/privacy" className="mt-8 inline-flex min-h-11 items-center text-signal underline">Политика обработки персональных данных</Link>
  </main>;
}

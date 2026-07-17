"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Disc3,
  Zap,
  Volume2,
  MonitorPlay,
  Lightbulb,
  Cable,
  type LucideIcon,
} from "lucide-react";
import SpecularButton from "./ui/SpecularButton";

interface Group {
  slug: string;
  title: string;
  icon: LucideIcon;
  links: { label: string; q?: string }[];
}

// Подкатегории — фильтры внутри категории (по названию товара)
const groups: Group[] = [
  {
    slug: "dinamiki-rupora",
    title: "Динамики",
    icon: Volume2,
    links: [
      { label: "Коаксиальные", q: "коаксиальные" },
      { label: "Эстрадные", q: "эстрадные" },
      { label: "Рупора", q: "рупор" },
      { label: "Колонки", q: "колонки" },
    ],
  },
  {
    slug: "usiliteli-monobloki",
    title: "Усилители",
    icon: Zap,
    links: [
      { label: "Моноблоки", q: "моноблок" },
      { label: "Усилители", q: "усилитель" },
      { label: "Платы", q: "плата" },
    ],
  },
  {
    slug: "sabvufery",
    title: "Сабвуферы",
    icon: Disc3,
    links: [
      { label: '10 дюймов', q: "10 дюймов" },
      { label: '12 дюймов', q: "12 дюймов" },
      { label: '15 дюймов', q: "15 дюймов" },
      { label: "В коробе", q: "коробе" },
    ],
  },
  {
    slug: "multimedia",
    title: "Мультимедиа",
    icon: MonitorPlay,
    links: [
      { label: "Магнитолы", q: "магнитола" },
      { label: "Камеры", q: "камера" },
    ],
  },
  {
    slug: "avtosvet",
    title: "Автосвет",
    icon: Lightbulb,
    links: [
      { label: "LED лампы", q: "led" },
      { label: "Ксенон", q: "ксенон" },
    ],
  },
  {
    slug: "aksessuary",
    title: "Аксессуары",
    icon: Cable,
    links: [
      { label: "Провода и кабели", q: "кабель" },
      { label: "Клеммы", q: "клемма" },
      { label: "Предохранители", q: "предохранитель" },
      { label: "Защитные сетки", q: "сетка" },
    ],
  },
];

function subHref(slug: string, q?: string) {
  const params = new URLSearchParams({ category: slug });
  if (q) params.set("search", q);
  return `/catalog?${params.toString()}`;
}

export function CatalogMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const header = ref.current?.closest("header");
    if (header) setTop(header.getBoundingClientRect().bottom);

    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <SpecularButton
        size="sm"
        radius={10}
        tint="#ff5500"
        tintOpacity={1}
        textColor="#ffffff"
        lineColor="#ffffff"
        baseColor="#b23a00"
        intensity={1.15}
        followMouse
        proximity={280}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <Menu size={16} strokeWidth={2.5} />
          Каталог
        </span>
      </SpecularButton>

      {open && (
        <>
          {/* затемнение страницы */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            style={{ top }}
            onClick={() => setOpen(false)}
          />
          {/* полноширинное мега-меню */}
          <div
            className="mega-menu-panel fixed inset-x-0 z-40 border-b border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            style={{ top }}
          >
            <div className="mx-auto max-w-[1200px] px-6 py-8">
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                {groups.map((g) => (
                  <div key={g.slug}>
                    <SpecularButton
                      size="sm"
                      radius={10}
                      tint="#ff5500"
                      tintOpacity={1}
                      textColor="#ffffff"
                      lineColor="#ffffff"
                      baseColor="#b23a00"
                      intensity={1.2}
                      followMouse
                      proximity={220}
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/catalog?category=${g.slug}`);
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <g.icon size={16} className="shrink-0" />
                        <span className="text-left">{g.title}</span>
                      </span>
                    </SpecularButton>

                    <ul className="mt-4 flex flex-col gap-2.5">
                      {g.links.map((l) => (
                        <li key={l.label}>
                          <Link
                            href={subHref(g.slug, l.q)}
                            onClick={() => setOpen(false)}
                            className="text-[0.86rem] text-muted-foreground transition-colors hover:text-signal"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

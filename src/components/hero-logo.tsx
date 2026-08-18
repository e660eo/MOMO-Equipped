import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 3D-логотип на главном экране.
 *
 * Логотип медленно парит за счёт CSS. Он остаётся серверным изображением и
 * виден до гидратации — декоративная анимация не должна скрывать бренд.
 *
 * У исходного рендера фон был непрозрачным; он вырезан заливкой от краёв
 * (см. подготовку ассета), поэтому PNG кладётся как есть — без blend-режимов,
 * которые всё равно схлопывались бы внутри этого transform-контекста.
 */
export function HeroLogo({ className }: { className?: string }) {
  return (
    <div className={cn("hero-logo-float", className)}>
      <Image
        src="/logo-3d.png"
        alt="Modern Original Music Organization"
        width={1500}
        height={985}
        priority
        sizes="(max-width: 768px) 94vw, 660px"
        className="dark-logo h-auto w-full"
      />
    </div>
  );
}

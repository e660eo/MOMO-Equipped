"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * 3D-логотип на главном экране.
 *
 * Вместо пульсации — «левитация»: логотип медленно парит (CSS-анимация на
 * внешнем слое) и мягко доворачивается вслед за курсором (пружина framer на
 * внутреннем), отчего рендер читается как настоящий объёмный объект.
 *
 * Слои разделены намеренно: CSS-анимация и inline-transform от framer иначе
 * перетирали бы друг друга.
 *
 * У исходного рендера фон был непрозрачным; он вырезан заливкой от краёв
 * (см. подготовку ассета), поэтому PNG кладётся как есть — без blend-режимов,
 * которые всё равно схлопывались бы внутри этого transform-контекста.
 */
export function HeroLogo({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 55, damping: 18, mass: 0.6 };
  const sx = useSpring(mx, spring);
  const sy = useSpring(my, spring);
  const rotateY = useTransform(sx, [-0.5, 0.5], [12, -12]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [-9, 9]);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, reduce]);

  return (
    <div className={cn("hero-logo-float", className)}>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={
          reduce
            ? undefined
            : { rotateX, rotateY, transformPerspective: 1400 }
        }
      >
        <Image
          src="/logo-3d.png"
          alt="MOMO Equipped"
          width={1500}
          height={985}
          priority
          sizes="(max-width: 768px) 94vw, 900px"
          className="h-auto w-full"
        />
      </motion.div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import "./SpecularButton.css";

/*
  Блик по кромке кнопки.

  Раньше здесь жил WebGL: на каждую кнопку заводился свой контекст ogl, свой
  бесконечный requestAnimationFrame и свой слушатель pointermove, который на
  каждое движение мыши спрашивал getBoundingClientRect. В шапке кнопок три, в
  открытом мега-меню — девять; все они считали кадры непрерывно, даже когда
  блик погашен, и вместе с ними в бандл уезжало 162 КБ библиотеки ogl.

  Рисунок теперь целиком на CSS (см. SpecularButton.css), а отсюда идут только
  два числа: угол блика и его яркость. Считает их один общий цикл на всю
  страницу — он просыпается на движение указателя и засыпает, когда все кнопки
  доехали до цели. Замеры раскладки собраны в начало кадра, до записей, чтобы
  не гонять браузер между «посчитай» и «перерисуй».
*/

interface Entry {
  el: HTMLElement;
  proximity: number;
  followMouse: boolean;
  autoAnimate: boolean;
  speed: number;
  intensity: number;
  /** Текущий угол и яркость — к ним плавно подтягиваемся каждый кадр. */
  angle: number;
  idleAngle: number;
  bright: number;
  rect: DOMRect | null;
}

const entries = new Set<Entry>();

let raf = 0;
let lastFrame = 0;
let pointerX = -1e6;
let pointerY = -1e6;
let pointerSeen = false;
let rectsDirty = true;
let listening = false;

/** Точный указатель есть — на тачскрине блик не рисуем и цикл не заводим. */
function finePointer() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function markRectsDirty() {
  rectsDirty = true;
  wake();
}

function onPointerMove(e: PointerEvent) {
  pointerX = e.clientX;
  pointerY = e.clientY;
  pointerSeen = true;
  wake();
}

function wake() {
  if (!raf && entries.size > 0) {
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function frame(now: number) {
  raf = 0;
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  // Сначала — все замеры разом. Раскладка пересчитается один раз на кадр,
  // а не по разу на кнопку, как было бы при чередовании чтений и записей.
  if (rectsDirty) {
    for (const en of entries) en.rect = en.el.getBoundingClientRect();
    rectsDirty = false;
  }

  let busy = false;

  for (const en of entries) {
    const rect = en.rect;
    if (!rect) continue;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Насколько указатель близко к кнопке: 1 — на ней, 0 — дальше proximity
    let proximityT = 0;
    let pointerAngle: number | null = null;
    if (pointerSeen) {
      const dx = Math.max(rect.left - pointerX, 0, pointerX - rect.right);
      const dy = Math.max(rect.top - pointerY, 0, pointerY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        // Над самой кнопкой свет садится на диагональ и слегка ведётся за курсором
        const nx = (pointerX - cx) / (rect.width / 2);
        const ny = (cy - pointerY) / (rect.height / 2);
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - pointerY, pointerX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(en.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    }

    en.idleAngle += en.speed * dt;
    const steer =
      en.followMouse && pointerAngle !== null && (!en.autoAnimate || proximityT > 0);
    const target = steer ? pointerAngle! : en.idleAngle;
    const diff = ((target - en.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    en.angle += diff * (1 - Math.exp(-dt * 7));

    const brightTarget = (en.autoAnimate ? 1 : proximityT) * en.intensity;
    en.bright += (brightTarget - en.bright) * (1 - Math.exp(-dt * 8));

    /*
      Угол уходит в rotate(), яркость — в opacity. Оба свойства composited:
      браузер не пересчитывает раскладку и не перерисовывает слой.
    */
    en.el.style.setProperty("--sb-angle", `${(en.angle * 180) / Math.PI}deg`);
    en.el.style.setProperty("--sb-bright", en.bright.toFixed(3));

    // Кнопка «доехала» — когда и яркость на месте, и угол сошёлся
    if (
      en.autoAnimate ||
      Math.abs(brightTarget - en.bright) > 0.002 ||
      (en.bright > 0.002 && Math.abs(diff) > 0.002)
    ) {
      busy = true;
    }
  }

  // Все на месте — цикл останавливается до следующего движения указателя
  if (busy) raf = requestAnimationFrame(frame);
}

function register(entry: Entry) {
  if (!listening) {
    listening = true;
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", markRectsDirty, { passive: true });
    window.addEventListener("resize", markRectsDirty, { passive: true });
  }
  entries.add(entry);
  rectsDirty = true;
  wake();
}

function unregister(entry: Entry) {
  entries.delete(entry);
  if (entries.size === 0) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    listening = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", markRectsDirty);
    window.removeEventListener("resize", markRectsDirty);
  }
}

export interface SpecularButtonProps {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  /** Ширина углового окна блика, градусы — сейчас задаётся в CSS. */
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  /** Render a native link when the control is used for navigation. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export default function SpecularButton({
  children = "Get Started",
  size = "lg",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0,
  blur = 0,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  thickness = 1.5,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  href,
  onClick,
  className = "",
  type = "button",
}: SpecularButtonProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  // Свежие настройки для цикла — без пересоздания подписки на каждый рендер
  const entryRef = useRef<Entry | null>(null);

  if (entryRef.current) {
    Object.assign(entryRef.current, {
      proximity,
      followMouse,
      autoAnimate,
      speed,
      intensity,
    });
  }

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !finePointer()) return;

    const entry: Entry = {
      el,
      proximity,
      followMouse,
      autoAnimate,
      speed,
      intensity,
      angle: 2.4,
      idleAngle: 2.4,
      bright: 0,
      rect: null,
    };
    entryRef.current = entry;
    register(entry);

    // Кнопка может ещё и переезжать сама (мега-меню, перенос строки)
    const ro = new ResizeObserver(markRectsDirty);
    ro.observe(el);

    return () => {
      ro.disconnect();
      unregister(entry);
      entryRef.current = null;
    };
    // Настройки подхватываются через entryRef выше — подписку не пересоздаём
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const controlClassName = `specular-button specular-button--${size}${className ? ` ${className}` : ""}`;
  const controlStyle = {
    "--sb-radius": `${radius}px`,
    "--sb-tint": tint,
    "--sb-tint-opacity": tintOpacity,
    "--sb-blur": `${blur}px`,
    "--sb-text-color": textColor,
    "--sb-line": lineColor,
    "--sb-base": baseColor,
    "--sb-thickness": `${thickness}px`,
  } as CSSProperties;
  const content = (
    <>
      <span className="specular-button__fx" aria-hidden="true">
        <span className="specular-button__spin" />
      </span>
      <span className="specular-button__label">{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        ref={(node) => {
          elementRef.current = node;
        }}
        href={href}
        aria-disabled={disabled || undefined}
        onClick={disabled ? (event) => event.preventDefault() : onClick}
        className={controlClassName}
        style={controlStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={(node) => {
        elementRef.current = node;
      }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={controlClassName}
      style={controlStyle}
    >
      {content}
    </button>
  );
}

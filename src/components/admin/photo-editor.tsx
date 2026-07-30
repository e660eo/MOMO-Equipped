"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";

/*
  Редактор фото товара — прямо в форме, без сервера.

  Поворот на 90°, обрезка выделением и «Убрать фон» (тот же приём, что при
  массовой обработке каталога: поднять точку белого по углам и залить фон от
  краёв в чистый белый — заливка от края не трогает светлые детали ВНУТРИ
  товара, потому что они не связаны с краем). Результат отдаётся как JPEG-файл
  в общий конвейер загрузки (saveProductImage сам обрежет поля и сожмёт в webp).

  Работаем с рабочим холстом полного размера (до 1600px), показываем его в
  масштабе. Все операции меняют рабочий холст, показ перерисовывается из него.
*/

const WORK_MAX = 1600;
const DISP_MAX = 480;

/** Отбеливание фона: точка белого по углам + заливка от краёв в 255. */
function removeBackground(data: Uint8ClampedArray, W: number, H: number) {
  const lum = (r: number, g: number, b: number) =>
    0.299 * r + 0.587 * g + 0.114 * b;
  const sat = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  // точка белого — медиана яркости уголков
  const k = Math.max(4, Math.floor(Math.min(W, H) * 0.06));
  const at = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return lum(data[i], data[i + 1], data[i + 2]);
  };
  const samples: number[] = [];
  for (let y = 0; y < k; y++)
    for (let x = 0; x < k; x++)
      samples.push(at(x, y), at(W - 1 - x, y), at(x, H - 1 - y), at(W - 1 - x, H - 1 - y));
  samples.sort((a, b) => a - b);
  const wp = samples[samples.length >> 1] || 255;
  const slope = Math.min(255 / Math.max(wp, 180), 1.3);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * slope);
    data[i + 1] = Math.min(255, data[i + 1] * slope);
    data[i + 2] = Math.min(255, data[i + 2] * slope);
  }
  // заливка фона от краёв
  const BG_LUM = 208,
    BG_SAT = 0.2;
  const vis = new Uint8Array(W * H);
  const st: number[] = [];
  const isBg = (p: number) => {
    const i = p * 4;
    return (
      lum(data[i], data[i + 1], data[i + 2]) >= BG_LUM &&
      sat(data[i], data[i + 1], data[i + 2]) <= BG_SAT
    );
  };
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (vis[p]) return;
    if (isBg(p)) {
      vis[p] = 1;
      st.push(p);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (st.length) {
    const p = st.pop()!;
    const x = p % W,
      y = (p / W) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let p = 0; p < W * H; p++)
    if (vis[p]) {
      const i = p * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
}

type Sel = { x: number; y: number; w: number; h: number };

export function PhotoEditor({
  src,
  fileName,
  onApply,
  onCancel,
}: {
  src: string | File;
  fileName: string;
  onApply: (file: File) => void;
  onCancel: () => void;
}) {
  const workRef = useRef<HTMLCanvasElement | null>(null); // рабочий холст (полный размер)
  const dispRef = useRef<HTMLCanvasElement>(null); // показ
  const scaleRef = useRef(1); // disp = work * scale
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Счётчик отрисовки: любая операция над рабочим холстом бампает его, а рендер
  // идёт в useEffect ниже — так он всегда выполняется ПОСЛЕ монтирования холста
  // показа (dispRef готов), без гонок с onload.
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  // Загрузка исходника в рабочий холст.
  useEffect(() => {
    let url: string | null = null;
    const img = new Image();
    if (typeof src === "string") img.src = src;
    else {
      url = URL.createObjectURL(src);
      img.src = url;
    }
    img.onload = () => {
      const scale = Math.min(WORK_MAX / img.width, WORK_MAX / img.height, 1);
      const work = document.createElement("canvas");
      work.width = Math.round(img.width * scale);
      work.height = Math.round(img.height * scale);
      work.getContext("2d")!.drawImage(img, 0, 0, work.width, work.height);
      workRef.current = work;
      setReady(true);
      bump();
      if (url) URL.revokeObjectURL(url);
    };
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  // Отрисовка показа из рабочего холста — на каждое изменение (tick) и на
  // движение выделения (sel). Эффект идёт после коммита, dispRef уже готов.
  useEffect(() => {
    const work = workRef.current,
      disp = dispRef.current;
    if (!work || !disp) return;
    const scale = Math.min(DISP_MAX / work.width, DISP_MAX / work.height, 1);
    scaleRef.current = scale;
    disp.width = Math.round(work.width * scale);
    disp.height = Math.round(work.height * scale);
    const ctx = disp.getContext("2d")!;
    ctx.drawImage(work, 0, 0, disp.width, disp.height);
    if (sel) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, disp.width, disp.height);
      ctx.clearRect(sel.x, sel.y, sel.w, sel.h);
      ctx.drawImage(
        work,
        sel.x / scale,
        sel.y / scale,
        sel.w / scale,
        sel.h / scale,
        sel.x,
        sel.y,
        sel.w,
        sel.h,
      );
      ctx.strokeStyle = "#ff5500";
      ctx.lineWidth = 2;
      ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
    }
  }, [tick, sel]);

  function rotate(dir: 1 | -1) {
    const work = workRef.current;
    if (!work) return;
    const rot = document.createElement("canvas");
    rot.width = work.height;
    rot.height = work.width;
    const ctx = rot.getContext("2d")!;
    ctx.translate(rot.width / 2, rot.height / 2);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.drawImage(work, -work.width / 2, -work.height / 2);
    workRef.current = rot;
    setSel(null);
    bump();
  }

  function applyBg() {
    const work = workRef.current;
    if (!work) return;
    setBusy(true);
    // даём кадру отрисовать «обрабатываю…»
    setTimeout(() => {
      const ctx = work.getContext("2d")!;
      const im = ctx.getImageData(0, 0, work.width, work.height);
      removeBackground(im.data, work.width, work.height);
      ctx.putImageData(im, 0, 0);
      setBusy(false);
      bump();
    }, 20);
  }

  function applyCrop() {
    const work = workRef.current;
    if (!work || !sel || sel.w < 8 || sel.h < 8) return;
    const s = scaleRef.current;
    const sx = Math.round(sel.x / s),
      sy = Math.round(sel.y / s);
    const sw = Math.round(sel.w / s),
      sh = Math.round(sel.h / s);
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);
    workRef.current = out;
    setSel(null);
    bump();
  }

  function pointerDown(e: RPointerEvent<HTMLCanvasElement>) {
    const r = dispRef.current!.getBoundingClientRect();
    dragRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function pointerMove(e: RPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const r = dispRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
    const s = dragRef.current;
    setSel({
      x: Math.min(s.x, x),
      y: Math.min(s.y, y),
      w: Math.abs(x - s.x),
      h: Math.abs(y - s.y),
    });
  }
  function pointerUp() {
    dragRef.current = null;
  }

  function apply() {
    const work = workRef.current;
    if (!work) return;
    setBusy(true);
    work.toBlob(
      (blob) => {
        if (!blob) {
          setBusy(false);
          return;
        }
        const base = fileName.replace(/\.[^.]+$/, "") || "photo";
        onApply(new File([blob], `${base}-edited.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  const btn =
    "rounded-sm border border-input bg-surface px-3 py-2 text-[0.8rem] font-medium transition-colors hover:border-signal disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[560px] rounded-md border border-border bg-background p-5 shadow-xl">
        <h3 className="text-[0.95rem] font-semibold">Редактор фото</h3>
        <p className="mt-1 text-[0.75rem] text-muted-foreground">
          Выдели область мышью для обрезки. «Убрать фон» делает фон чисто-белым.
        </p>

        <div className="mt-4 flex min-h-[300px] items-center justify-center rounded-sm bg-tile p-3">
          {/* Холст всегда в DOM (прячем до готовности) — иначе ref пуст в момент
              первой отрисовки и картинка не появляется. */}
          <canvas
            ref={dispRef}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            className={`max-h-[480px] max-w-full cursor-crosshair touch-none ${
              ready ? "" : "hidden"
            }`}
          />
          {!ready && (
            <span className="text-[0.8rem] text-muted-foreground">
              Загрузка…
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => rotate(-1)} disabled={!ready || busy}>
            ⟲ Влево
          </button>
          <button type="button" className={btn} onClick={() => rotate(1)} disabled={!ready || busy}>
            ⟳ Вправо
          </button>
          <button type="button" className={btn} onClick={applyCrop} disabled={!ready || busy || !sel}>
            Обрезать по выделению
          </button>
          <button type="button" className={btn} onClick={() => setSel(null)} disabled={!ready || busy || !sel}>
            Сбросить выделение
          </button>
          <button type="button" className={btn} onClick={applyBg} disabled={!ready || busy}>
            {busy ? "Обрабатываю…" : "Убрать фон"}
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={apply}
            disabled={!ready || busy}
            className="rounded-sm bg-signal px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-95 disabled:opacity-60"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[0.85rem] text-muted-foreground transition-colors hover:text-signal"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

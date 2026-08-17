"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { RotateCcw, RotateCw, Sparkles, X } from "lucide-react";

const WORK_MAX = 1800;

type AspectOption = {
  label: string;
  value: number | undefined;
};

const aspects: AspectOption[] = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "Свободно", value: undefined },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function rotatedSize(width: number, height: number, rotation: number) {
  const angle = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(angle) * width) + Math.abs(Math.sin(angle) * height),
    height: Math.abs(Math.sin(angle) * width) + Math.abs(Math.cos(angle) * height),
  };
}

async function cropImage(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  fileName: string,
) {
  const image = await loadImage(imageSrc);
  const bounds = rotatedSize(image.width, image.height, rotation);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bounds.width);
  canvas.height = Math.round(bounds.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.translate(-image.width / 2, -image.height / 2);
  context.drawImage(image, 0, 0);

  const result = document.createElement("canvas");
  result.width = Math.max(1, Math.round(pixelCrop.width));
  result.height = Math.max(1, Math.round(pixelCrop.height));
  const resultContext = result.getContext("2d");
  if (!resultContext) throw new Error("Canvas is not supported");
  resultContext.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    result.width,
    result.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    result.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Image export failed"))),
      "image/jpeg",
      0.92,
    );
  });
  const base = fileName.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}-edited.jpg`, { type: "image/jpeg" });
}

function removeWhiteBackground(data: Uint8ClampedArray, width: number, height: number) {
  const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = (r: number, g: number, b: number) => {
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    return maximum === 0 ? 0 : (maximum - minimum) / maximum;
  };
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const isBackground = (pixel: number) => {
    const index = pixel * 4;
    return (
      luminance(data[index], data[index + 1], data[index + 2]) >= 208 &&
      saturation(data[index], data[index + 1], data[index + 2]) <= 0.2
    );
  };
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    stack.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const pixel = stack.pop()!;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (!visited[pixel]) continue;
    const index = pixel * 4;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
  }
}

async function cleanBackground(imageSrc: string) {
  const image = await loadImage(imageSrc);
  const scale = Math.min(WORK_MAX / image.width, WORK_MAX / image.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  removeWhiteBackground(pixels.data, canvas.width, canvas.height);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.94);
}

export function ImageCropper({
  src,
  fileName,
  applyLabel = "Применить",
  onApply,
  onCancel,
}: {
  src: string | File;
  fileName: string;
  applyLabel?: string;
  onApply: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = typeof src === "string" ? null : URL.createObjectURL(src);
    setImageSrc(typeof src === "string" ? src : objectUrl!);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedArea(null);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onCancel]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function apply() {
    if (!imageSrc || !croppedArea) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(await cropImage(imageSrc, croppedArea, rotation, fileName));
    } catch {
      setError("Не удалось подготовить изображение. Выберите другой файл.");
      setBusy(false);
    }
  }

  async function removeBackground() {
    if (!imageSrc) return;
    setBusy(true);
    setError(null);
    try {
      setImageSrc(await cleanBackground(imageSrc));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch {
      setError("Не удалось очистить фон этого изображения.");
    } finally {
      setBusy(false);
    }
  }

  const toolButton =
    "inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-input bg-surface px-3 text-[0.78rem] font-semibold transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/35 disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onPointerDown={(event) => event.target === event.currentTarget && !busy && onCancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
        className="w-full max-w-[780px] overflow-hidden rounded-md border border-border bg-background shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h3 id="image-cropper-title" className="text-base font-bold">Подготовка фото</h3>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              Перетащите снимок внутри рамки и настройте масштаб.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Закрыть редактор" className="rounded-sm p-2 text-muted-foreground hover:bg-tile hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/35 disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        <div className="relative h-[min(52vh,460px)] min-h-[300px] bg-[#171717]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
          <div className="pointer-events-none absolute left-3 top-3 rounded-sm bg-black/65 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80">
            Область карточки
          </div>
        </div>

        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[1fr_auto] sm:p-6">
          <div className="space-y-4">
            <label className="grid gap-2 text-[0.75rem] font-medium sm:grid-cols-[80px_1fr_40px] sm:items-center">
              <span>Масштаб</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer accent-[var(--color-signal)]"
              />
              <span className="font-mono text-[0.7rem] text-muted-foreground">{zoom.toFixed(1)}×</span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[0.75rem] font-medium">Формат</span>
              {aspects.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAspect(option.value)}
                  className={`rounded-sm border px-2.5 py-1.5 text-[0.72rem] font-semibold transition-colors ${
                    aspect === option.value
                      ? "border-signal bg-signal text-white"
                      : "border-input bg-surface text-muted-foreground hover:border-signal hover:text-signal"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRotation((value) => value - 90)} disabled={busy} className={toolButton}>
                <RotateCcw size={15} /> Влево
              </button>
              <button type="button" onClick={() => setRotation((value) => value + 90)} disabled={busy} className={toolButton}>
                <RotateCw size={15} /> Вправо
              </button>
              <button type="button" onClick={removeBackground} disabled={busy} className={toolButton}>
                <Sparkles size={15} /> {busy ? "Обработка…" : "Очистить фон"}
              </button>
            </div>
          </div>

          <div className="flex items-end gap-3 sm:flex-col sm:justify-end">
            <button type="button" onClick={apply} disabled={busy || !croppedArea} className="rounded-sm bg-signal px-5 py-2.5 text-[0.82rem] font-semibold text-white transition-colors hover:bg-[#ff6a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/35 focus-visible:ring-offset-2 disabled:opacity-50">
              {busy ? "Готовлю…" : applyLabel}
            </button>
            <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-2 text-[0.8rem] text-muted-foreground hover:text-foreground disabled:opacity-50">
              Отмена
            </button>
          </div>
        </div>
        {error && <p role="alert" className="border-t border-border px-4 py-3 text-[0.78rem] text-[var(--signal-text)] sm:px-6">{error}</p>}
      </section>
    </div>
  );
}

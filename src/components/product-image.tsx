"use client";

import { useState } from "react";
import Image from "next/image";

/*
  Фото товара.

  Снимки лежат в папке данных в исходном размере (около 790×790), а в плитке
  каталога занимают примерно 250 px — раньше браузер тянул оригиналы, и одна
  страница каталога весила больше мегабайта. Теперь размер подбирается под
  вёрстку: `sizes` описывает, сколько места картинка займёт, а Next отдаёт
  подходящий вариант и грузит его лениво.

  При недоступном файле показываем фирменный плейсхолдер обычным <img> —
  оптимизатор с SVG не работает, да и незачем.
*/
export function ProductImage({
  src,
  alt,
  className,
  sizes = "(max-width: 639px) calc(50vw - 28px), (max-width: 1023px) calc(33vw - 28px), 256px",
  priority = false,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Сколько места картинка занимает в вёрстке — от этого зависит размер файла. */
  sizes?: string;
  /** Для снимка, который виден сразу: грузим без задержки. */
  priority?: boolean;
  /**
   * Снимок догрузился. Нужен там, где картинку показывают только после
   * загрузки: проявлять пустое место, пока файл едет, — хуже, чем подождать.
   */
  onLoad?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/placeholder.svg" alt={alt} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={1600}
      height={1600}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      onError={() => setFailed(true)}
      onLoad={onLoad}
      className={className}
    />
  );
}

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
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Сколько места картинка занимает в вёрстке — от этого зависит размер файла. */
  sizes?: string;
  /** Для снимка, который виден сразу: грузим без задержки. */
  priority?: boolean;
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
      width={900}
      height={900}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

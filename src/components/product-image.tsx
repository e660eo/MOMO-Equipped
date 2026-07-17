"use client";

import { useState } from "react";

/*
  Фото товара. Пока источники — старый сайт momo-eq.ru (temporary, до переезда
  в CMS в Фазе 2), поэтому next/image здесь не оптимизирует, а при недоступности
  фото показывается фирменный плейсхолдер вместо «битой» картинки.
*/
export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? "/placeholder.svg" : src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

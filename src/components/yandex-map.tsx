/*
  Встраиваемая Яндекс.Карта — виджет по текстовому запросу, API-ключ не нужен.
  Серверный компонент: обычный iframe, грузится лениво, чтобы не тормозить
  страницу. В песочнице разработки внешний хост заблокирован и рамка пустая —
  на живом сайте карта отображается.
*/
export function YandexMap({
  query,
  zoom = 16,
  className = "",
  title = "Карта проезда",
}: {
  query: string;
  zoom?: number;
  className?: string;
  title?: string;
}) {
  const src = `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(query)}&z=${zoom}`;
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-tile ${className}`}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-[360px] w-full border-0 sm:h-[420px]"
      />
    </div>
  );
}

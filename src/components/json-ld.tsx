/*
  Печатает объект схемы в <script type="application/ld+json">.
  Серверный компонент — разметка уходит в HTML при рендере, JS на клиенте не нужен.

  Экранируем «<», чтобы строка в данных (например, в названии товара) не могла
  закрыть тег скрипта раньше времени и превратиться в исполняемый разметкой узел.
*/
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

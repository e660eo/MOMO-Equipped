/*
  Разбор текста статьи.

  Владелец пишет статью обычным текстом в панели, а не в редакторе с кнопками.
  Значит нужен способ обозначить подзаголовок и список, не заставляя человека
  помнить HTML. Правил ровно три, все подсмотрены у мессенджеров:

    ## Подзаголовок     — строка, начинающаяся с решёток
    - пункт             — строка с дефисом или звёздочкой
    1. пункт            — строка с числом и точкой
    пустая строка       — граница абзаца

  Почему разбираем в блоки, а не храним HTML: разметку из панели пришлось бы
  чистить перед показом, а вычищать «плохие» теги регулярками обходится
  десятком известных способов (об этом же предупреждает src/lib/sanitize.ts).
  Здесь HTML не появляется вовсе — на выходе структура, которую React рисует
  обычными элементами, и `<script>` в тексте останется набором букв на экране.
*/

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const HEADING = /^#{2,3}\s+(.+)$/;
const BULLET = /^[-*•]\s+(.+)$/;
const NUMBERED = /^\d{1,2}[.)]\s+(.+)$/;

/** Текст статьи → блоки для отрисовки. */
export function parseArticle(body: string): Block[] {
  const blocks: Block[] = [];
  // \r\n приезжает из Windows-браузеров: без нормализации строка «- пункт\r»
  // не совпадёт с шаблоном списка.
  const lines = body.replace(/\r\n?/g, "\n").split("\n");

  // Копим соседние строки: абзац собирается из строк подряд, список — из
  // пунктов подряд. Пустая строка или другой вид строки закрывает начатое.
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function flush(): void {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = !bullet ? NUMBERED.exec(line) : null;
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const text = (bullet ?? numbered)![1].trim();
      // Смена вида списка начинает новый: маркеры и цифры в одном перечне
      // читаются как ошибка вёрстки.
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(text);
      continue;
    }

    // Обычная строка. Начатый список она закрывает: продолжение пункта с
    // новой строки без маркера встречается реже, чем забытая пустая строка.
    if (list) flush();
    paragraph.push(line);
  }

  flush();
  return blocks;
}

/** Есть ли в заметке полный текст, а не только анонс. */
export function hasArticle(body: string | undefined): boolean {
  return Boolean(body && parseArticle(body).length > 0);
}

/*
  Сколько читать. Ориентир — 900 знаков в минуту: это медленнее «слов в
  минуту» из английских статей, зато не обещает прочесть разбор установки
  за полминуты.
*/
const CHARS_PER_MINUTE = 900;

export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.length / CHARS_PER_MINUTE));
}

/**
 * Текст статьи без разметки — для описания страницы и для поисковиков.
 * Решётки и дефисы в сниппете выглядят как мусор.
 */
export function articlePlainText(body: string, limit = 300): string {
  const text = parseArticle(body)
    .map((block) => {
      if (block.kind === "list") return block.items.join(". ");
      return block.text;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= limit) return text;
  // Режем по границе слова, чтобы описание не обрывалось на полуслове.
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${space > limit * 0.6 ? cut.slice(0, space) : cut}…`;
}

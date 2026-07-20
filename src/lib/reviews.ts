/*
  Отзывы и рейтинг — сид v1.
  Значения детерминированы по slug (одинаковы при каждом рендере и в SSR),
  чтобы не «прыгали» и не ломали гидрацию. Позже getRating/getReviews
  сохранят сигнатуры, но начнут брать реальные отзывы с маркетплейсов.
*/

export interface Review {
  author: string;
  rating: number;
  date: string;
  text: string;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Средний рейтинг и число отзывов — стабильно по slug, смещено к высоким. */
export function getRating(slug: string): { value: number; count: number } {
  const h = hash(slug);
  const value = Math.min(5, Math.round((3.9 + (h % 12) / 11) * 10) / 10);
  const count = 3 + ((h >>> 4) % 138);
  return { value, count };
}

/** Склонение слова «отзыв» под число: 1 отзыв, 2 отзыва, 5 отзывов. */
export function pluralReviews(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "отзыв";
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "отзыва";
  return "отзывов";
}

const authors = [
  "Артур",
  "Рустам",
  "Дмитрий М.",
  "Заур",
  "Николай",
  "Ислам",
  "Сергей В.",
  "Магомед",
  "Андрей",
  "Тимур",
  "Виталий",
  "Алексей К.",
];

const texts = [
  "Бас глубокий, чувствуется в груди. Упаковано отлично, доставили быстро.",
  "Брал под свою машину — по мощности всё как заявлено, качеством доволен.",
  "Звук чистый на любой громкости, ничего не хрипит. Рекомендую.",
  "Ставил сам, менеджер помог с подключением по телефону — спасибо.",
  "Цена-качество на высоте, за эти деньги лучше не найти.",
  "Пришло целым, играет мощно. Магазину доверяю, беру не первый раз.",
  "Добротная сборка, материалы качественные. Работает без нареканий.",
  "Консультация топ, подобрали комплект под мой бюджет. Доволен.",
  "Громко, чётко, надёжно. Друзья уже спрашивают, где брал.",
  "Всё по описанию, доставка точно в срок. Возьму ещё.",
];

/** Несколько текстовых отзывов, детерминированных по slug. */
export function getReviews(slug: string): Review[] {
  const h = hash(slug);
  const n = 2 + (h % 4); // 2..5
  const list: Review[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (h + i * 7) % texts.length;
    const aidx = (h + i * 3) % authors.length;
    const rating = ((h >>> (i + 1)) % 6 === 0) ? 4 : 5; // в основном 5, изредка 4
    const daysAgo = 8 + ((h + i * 29) % 220);
    const date = new Date(Date.now() - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10);
    list.push({ author: authors[aidx], text: texts[idx], rating, date });
  }
  return list;
}

import { readJson, updateJson } from "./store";
import type { Product } from "./types";

/*
  Чистка названий товаров под витрину.

  Прайс поставщика писал их с мусором — «Моноблок автомобильный BD-5000.1» —
  и ставил размер в середину. Владелец попросил убрать лишние слова и увести
  диаметр в конец, к коду модели. Три правила:

    1) убрать «автомобильный / в машину / для машины / для автомобиля» как
       отдельные слова. «Авто*» широко НЕ трогаем: «автозвук», «автоакустика»,
       «автомагнитола» — нормальные слова, не мусор;
    2) «12 дюймов» → «12 дюйм» (короткая форма, как просил владелец);
    3) диаметр (Nсм / Nмм) — в конец названия, но ТОЛЬКО у динамиков, колонок
       и рупоров. У кабеля «5х21мм2», кулера «50х50х10мм», магнитолы «9″» и
       защитных сеток «16 см комплект 2 шт» размерный токен значит совсем
       другое — там перестановка сломала бы название.

  ⚠️ Кириллица: в JS `\b` и `\w` опираются на ASCII, после кириллицы границы
  слова НЕТ. Поэтому границы — через пробелы-паддинг и lookahead `(?![а-яё])`.

  Функция идемпотентна: повторный прогон уже чистого названия ничего не меняет —
  на этом держится самоограничение миграции ниже.
*/

const isSpeaker = (t: string) => /динамик|колонк|рупор/i.test(t);

function stripFiller(t: string): string {
  t = " " + t + " ";
  // многословные фразы — сначала
  t = t.replace(/ для автомобил(?:я|ей)(?![а-яё])/gi, " ");
  t = t.replace(/ для машины?(?![а-яё])/gi, " ");
  t = t.replace(/ в машину(?![а-яё])/gi, " ");
  t = t.replace(/ в машине(?![а-яё])/gi, " ");
  t = t.replace(/ для авто(?![а-яё])/gi, " ");
  // прилагательное «автомобильн*» в любой форме
  t = t.replace(/ автомобильн[а-яё]*(?![а-яё])/gi, " ");
  return t.replace(/\s+([.,;])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function normDyuym(t: string): string {
  return t.replace(/(\d)\s*дюйм(?:ов|а|ы)?(?![а-яё])/gi, "$1 дюйм");
}

function sizeToEnd(t: string): string {
  if (!isSpeaker(t)) return t;
  /*
    Хвост-пометку уценки отделяем, чтобы размер встал ПЕРЕД ней:
    «…HE-290 100мм. Товар уцененный», а не «…HE-290. Товар уцененный 100мм».
  */
  let suffix = "";
  const sm = t.match(/\.\s*Товар\s+уцен[её]нн[а-яё]*\s*$/i);
  if (sm) {
    suffix = ". Товар уцененный";
    t = t.slice(0, sm.index).trim();
  }
  // Простой диаметр Nсм/Nмм — не часть «5х21мм2» (перед — не цифра/×) и не «мм²».
  const re = /(?<![\dхx.,])(\d{1,3})\s*(см|мм)(?![а-яё2])/i;
  const m = t.match(re);
  if (!m || m.index === undefined) return (t + suffix).trim();
  const idx = m.index;
  const size = m[1] + m[2]; // «16»+«см» → «16см», слитно, как в данных
  const rest = (t.slice(0, idx) + t.slice(idx + m[0].length))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
  return `${rest} ${size}${suffix}`.replace(/\s{2,}/g, " ").trim();
}

/** Название товара под витрину: filler убран, размер в конце, «дюйм» короткий. */
export function cleanProductTitle(title: string): string {
  return sizeToEnd(normDyuym(stripFiller(title || "")));
}

/*
  Одноразовая миграция названий в живых данных — вызывается из instrumentation
  на старте сервера. Данные лежат вне репозитория (MOMO_DATA_DIR), поэтому
  правка в репозитории до них не доедет; чистим их там, где они есть.

  Самоограничение: если чистить нечего — НЕ пишем (иначе плодили бы бэкап на
  каждый рестарт). Как только все названия чисты, `some(...)` даёт false и
  миграция становится тихой. Запись — через updateJson (атомарно + копия в
  backups/), как требует правило хранилища.
*/
export function cleanupProductTitles(): { changed: number } {
  const current = readJson<Product[]>("products.json");
  if (!current.some((p) => cleanProductTitle(p.title) !== p.title)) {
    return { changed: 0 };
  }
  let changed = 0;
  updateJson<Product[]>("products.json", (list) =>
    list.map((p) => {
      const title = cleanProductTitle(p.title);
      if (title === p.title) return p;
      changed++;
      return { ...p, title };
    }),
  );
  return { changed };
}

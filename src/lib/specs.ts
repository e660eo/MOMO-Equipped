/*
  Характеристики из названия товара — эвристический парсер v1.
  В данных с витрины нет отдельных полей характеристик, но в title они есть
  («…3200 Лм 5000-6000K 23000Вт… комплект 2 шт»). Достаём то, что распознаём
  уверенно, и показываем чипами. В фазе CMS заменяется реальными полями.
*/

import { plural } from "./utils";

export interface Spec {
  label: string;
  value: string;
}

/**
 * Потолок правдоподобия для мощности. Самые громкие моноблоки в каталоге
 * заявляют 5100 Вт пиковой — всё, что выше 10 кВт, приходит из рекламных
 * названий, а не из характеристик товара.
 */
const POWER_SANITY_W = 10000;

export function parseSpecs(title: string): Spec[] {
  const out: Spec[] = [];
  const seen = new Set<string>();

  const add = (label: string, value: string) => {
    const key = label + value;
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push({ label, value });
  };

  // Сечение провода: «5x21мм2» — раньше правила «мм», иначе съест его.
  const cross = title.match(/(\d+)\s*[xх]\s*([\d.,]+)\s*мм\s*2/i);
  if (cross) add("Сечение", `${cross[1]}×${cross[2]} мм²`);

  /*
    Внимание: в JS `\b` опирается на ASCII-\w, поэтому после кириллицы
    («Вт», «Лм», «Ом») границы слова НЕ будет. Вместо неё — lookahead.
  */

  /*
    Числа матчим без пробелов внутри: иначе `[\d\s]*` перепрыгивает пробел
    и склеивает соседние токены («H4 3000-3200Лм» → «43000-3200»).
  */

  // Мощность. Выше POWER_SANITY_W не показываем: в названиях с витрины
  // попадается рекламный мусор («ксеноновая лампа H4 … 23000Вт»), и такая
  // характеристика в карточке выглядит как ошибка магазина.
  const power = title.match(/(\d{1,6})\s*(?:вт(?![а-яё])|ватт|w\b)/i);
  if (power && parseInt(power[1], 10) <= POWER_SANITY_W)
    add("Мощность", `${power[1]} Вт`);

  // Световой поток (одно значение или диапазон)
  const lumen = title.match(
    /(\d{2,5})(?:\s*[-–]\s*(\d{2,5}))?\s*лм(?![а-яё])/i,
  );
  if (lumen)
    add(
      "Световой поток",
      lumen[2] ? `${lumen[1]}–${lumen[2]} Лм` : `${lumen[1]} Лм`,
    );

  // Цветовая температура: диапазон «5000-6000K» либо перечисление «3500K/5500K/6500K»
  const kRange = title.match(/(\d{4})\s*[-–]\s*(\d{4})\s*K\b/i);
  if (kRange) {
    add("Температура", `${kRange[1]}–${kRange[2]} K`);
  } else {
    const kelvins = title.match(/\d{4}\s*K\b/gi);
    if (kelvins && kelvins.length) {
      const uniq = [
        ...new Set(kelvins.map((k) => parseInt(k, 10))),
      ].sort((a, b) => a - b);
      add(
        "Температура",
        uniq.length > 1
          ? `${uniq[0]}–${uniq[uniq.length - 1]} K`
          : `${uniq[0]} K`,
      );
    }
  }

  // Диаметр / типоразмер
  const inch = title.match(/(\d{1,2})\s*дюйм/i);
  if (inch) add("Размер", `${inch[1]}″`);
  const cm = title.match(/(\d{2})\s*см(?![а-яё])/i);
  if (cm) add("Размер", `${cm[1]} см`);
  if (!cross) {
    const mm = title.match(/(\d{2,4})\s*мм(?![а-яё2])/i);
    if (mm) add("Размер", `${mm[1]} мм`);
  }

  // Сопротивление
  const ohm = title.match(/([\d.,]+)\s*ом(?![а-яё])/i);
  if (ohm) add("Сопротивление", `${ohm[1]} Ом`);

  // Калибр провода
  const ga = title.match(/(\d+)\s*GA\b/i);
  if (ga) add("Калибр", `${ga[1]} GA`);

  // Длина
  const len = title.match(/(\d+(?:[.,]\d+)?)\s*m\.?(?![a-zа-я])/i);
  if (len) add("Длина", `${len[1]} м`);

  // Память
  const gb = title.match(/(\d+)\s*GB\b/i);
  if (gb) add("Память", `${gb[1]} GB`);

  // Комплектность
  const pcs = title.match(/(\d+)\s*шт/i);
  if (pcs) add("В комплекте", `${pcs[1]} шт`);

  // Ключевые особенности
  const features: string[] = [];
  if (/wi-?fi/i.test(title)) features.push("Wi-Fi");
  if (/\bgps\b/i.test(title)) features.push("GPS");
  if (/bluetooth|\bbt\b/i.test(title)) features.push("Bluetooth");
  if (/canbus/i.test(title)) features.push("Canbus");
  if (/\bмедь\b|лужёная|luzhenaya/i.test(title)) features.push("Медь");
  const android = title.match(/android\s*(\d+)/i);
  if (android) features.push(`Android ${android[1]}`);
  if (features.length) add("Особенности", features.join(" · "));

  return out;
}

/** Короткие чипы для карточки товара. */
export function shortSpecs(title: string, limit = 2): string[] {
  return parseSpecs(title)
    .filter((s) => s.label !== "Особенности")
    .slice(0, limit)
    .map((s) => s.value);
}

/* ------------------------------------------------------------------ */
/* Технические поля для фильтров каталога                              */
/* ------------------------------------------------------------------ */

export interface TechSpec {
  diameterMm?: number;
  powerMaxW?: number;
  impedanceOhm?: number;
}

/**
 * Диаметр, мощность и сопротивление из названия + описания (из прайса).
 * Значения достаём только при явной единице измерения — коды моделей вроде
 * «TS-10.600» цифрами похожи на характеристики, но единиц не содержат.
 */
/*
  Диаметр из произвольного куска текста.

  Возвращает первое правдоподобное значение в миллиметрах, перебирая все
  найденные числа с единицами — а не первое совпадение самой приоритетной
  единицы. Разница принципиальная: в описаниях прайса рядом с «Диаметр -
  165mm» стоит «Звуковая катушка - 1 Дюйм», и при жёстком приоритете
  «дюймы важнее миллиметров» динамик получал диаметр катушки — 25 мм.
  Плашка с таким числом не показывалась вовсе (мельче 80 мм — это уже не
  диффузор), и товар оставался без характеристик.

  Правдоподобность проверяем той же корзиной, что и фильтр каталога: если
  число не попадает ни в один размер динамика, это не диаметр.
*/
/*
  Максимальная мощность из текста.

  Поставщик пишет её тремя способами вперемешку: «Мощность MAX - 160 W»,
  «MAX: 300 Вт» и по-русски — «Максимальная мощность: 140 Вт». Раньше
  распознавался только латинский MAX, поэтому половина эстрадных колонок
  оставалась без плашки мощности, хотя число было прямо в описании.

  «BT» — постоянная опечатка «Вт» в прайсе (латинская раскладка), но
  принимаем её только сразу после числа.
*/
const POWER_MAX_RE =
  /(?:max|макс[а-яё]*(?:\s+мощност[а-яё]*)?|мощност[а-яё]*\s*max)\s*[:\-–—]?\s*(\d{2,5})\s*(?:W|Вт|BT)/i;

function powerMaxFrom(text: string): number | undefined {
  const m = text.match(POWER_MAX_RE);
  if (!m) return undefined;
  const w = parseInt(m[1], 10);
  return w <= POWER_SANITY_W ? w : undefined;
}

/*
  Разбор кода модели: «буквы-ПЕРВОЕ.ВТОРОЕ».

  Второе число всегда мощность в ваттах, первое читается по типу товара:
    • сабвуфер   B-12.750  → 12 дюймов и 750 Вт номинала;
    • усилитель  AB-4.120  → 4 канала и 120 Вт на канал;
    • моноблок   M-1.800   → 1 канал и 800 Вт.

  Расшифровку подтвердил владелец, и она сходится со всеми описаниями, где
  указаны и код, и мощность: у AB-4.120 в прайсе «4 Ом: 4 × 120 Вт», у
  M-1.800 «1 Ом: 800 Вт», у сабвуфера TS-10.600 «Мощность RMS - 600 BT».

  Требуем строгую форму: 1–3 буквы, дефис, одна-две цифры, точка, две-четыре
  цифры. Коды вне её мы не трогаем — они означают другое:
    • BD-5000.1, BD-3000.1 — бразильская схема, тут наоборот мощность.точка.
      каналы; первое число 5000 не проходит «одна-две цифры» и код мимо;
    • D-1000, M-600, FR-500 — без точки, мощности отсюда не берём;
    • MR-6.1, HE-1000 — не подходят под форму вовсе.
*/
const MODEL_CODE_RE =
  /(?:^|[\s+(])[A-Za-zА-Яа-я]{1,3}-(\d{1,2})\.(\d{2,4})(?!\d)/;

interface ModelCode {
  /** Первое число кода: дюймы у сабвуфера, каналы у усилителя. */
  first: number;
  /** Второе число: мощность в ваттах. */
  power: number;
}

function modelCode(title: string): ModelCode | null {
  const m = title.match(MODEL_CODE_RE);
  if (!m) return null;
  const power = parseInt(m[2], 10);
  if (power > POWER_SANITY_W) return null;
  return { first: parseInt(m[1], 10), power };
}

// «Плата на усилитель/моноблок» тоже сюда: слова есть в названии.
const isAmplifier = (title: string) => /усилител|моноблок/i.test(title);
/*
  Настоящий сабвуфер, а не «Моноблок … для сабвуфера»: у последнего в
  названии есть и «сабвуфер», и «моноблок», но по сути это усилитель.
  Усилитель главнее — иначе моноблок получил бы плашку диаметра из
  габаритов корпуса в описании.
*/
const isSubwoofer = (title: string) =>
  /сабвуфер/i.test(title) && !isAmplifier(title);

function diameterFrom(text: string): number | undefined {
  const candidates: number[] = [];

  const add = (mm: number) => {
    if (diameterBucket(mm)) candidates.push(mm);
  };

  for (const m of text.matchAll(
    /(?<![\d.,])(\d{2}(?:[.,]\d)?)\s*(?:см|cm)(?![а-яёa-z])/gi,
  )) {
    add(Math.round(parseFloat(m[1].replace(",", ".")) * 10));
  }
  // Апостроф — тоже дюймы: в прайсе короба записаны как «12'» и «15'».
  for (const m of text.matchAll(
    /(?<![\d.,])(\d{1,2}(?:[.,]\d)?)\s*(?:дюйм|″|"|'|’|′)/gi,
  )) {
    add(Math.round(parseFloat(m[1].replace(",", ".")) * 25.4));
  }
  for (const m of text.matchAll(
    /(?<![\d.,x×х])(\d{2,3})\s*(?:мм|mm)(?![а-яёa-z2])/gi,
  )) {
    add(parseInt(m[1], 10));
  }

  return candidates[0];
}

export function parseTech(title: string, description?: string[]): TechSpec {
  const src = [title, ...(description ?? [])].join(" · ");
  const out: TechSpec = {};

  /*
    Диаметр ищем по убыванию надёжности источника:
      1) строка описания, прямо названная «Диаметр» или «Размер»;
      2) название товара — там размер пишут для покупателя;
      3) всё описание целиком.
    Так подпись поставщика всегда главнее случайного числа из соседней строки.
  */
  const labeled = (description ?? []).find((line) =>
    /^\s*(?:диаметр|размер)\b/i.test(line),
  );
  out.diameterMm =
    (labeled ? diameterFrom(labeled) : undefined) ??
    diameterFrom(title) ??
    diameterFrom((description ?? []).join(" · "));

  // Мощность: подписанный максимум приоритетнее случайного числа с «Вт».
  const pAny = src.match(/(\d{2,5})\s*(?:Вт(?![а-яё])|W\b|BT\b)/i);
  const anyW = pAny ? parseInt(pAny[1], 10) : undefined;
  out.powerMaxW =
    powerMaxFrom(src) ??
    (anyW !== undefined && anyW <= POWER_SANITY_W ? anyW : undefined);

  // Сопротивление: 1/2/4 Ом (диапазон реальный для автозвука)
  const ohm = src.match(/(?<![\d.,])([124])\s*(?:ом|ohm|om)(?![а-яёa-z])/i);
  if (ohm) out.impedanceOhm = parseInt(ohm[1], 10);

  return out;
}

/** Диаметр → человекочитаемая корзина для фильтра. */
export function diameterBucket(mm: number): string | null {
  if (mm < 80) return null; // катушки и прочая мелочь — не диаметр динамика
  if (mm <= 110) return "10 см (4″)";
  if (mm <= 145) return "13 см (5.25″)";
  if (mm <= 180) return "16–17 см (6.5″)";
  if (mm <= 220) return "20 см (8″)";
  if (mm <= 280) return "25 см (10″)";
  if (mm <= 330) return "30 см (12″)";
  if (mm <= 420) return "38 см (15″)";
  return null;
}

/** Мощность → корзина для фильтра. */
export function powerBucket(w: number): string | null {
  if (w < 20) return null;
  if (w <= 150) return "до 150 Вт";
  if (w <= 400) return "150–400 Вт";
  if (w <= 1000) return "400–1000 Вт";
  return "свыше 1000 Вт";
}

/** Порядок корзин в выпадающих списках. */
export const DIAMETER_ORDER = [
  "10 см (4″)",
  "13 см (5.25″)",
  "16–17 см (6.5″)",
  "20 см (8″)",
  "25 см (10″)",
  "30 см (12″)",
  "38 см (15″)",
];
export const POWER_ORDER = [
  "до 150 Вт",
  "150–400 Вт",
  "400–1000 Вт",
  "свыше 1000 Вт",
];

/* ------------------------------------------------------------------ */
/* Полные характеристики для карточки товара                           */
/* ------------------------------------------------------------------ */

export interface ProductSpecs {
  /** Ключевые цифры для крупных плашек: мощность, диаметр, сопротивление. */
  stats: Spec[];
  /** Таблица «ключ: значение»; value === "" — подзаголовок группы. */
  rows: Spec[];
  /** Строки описания без ключа — обычные пункты. */
  notes: string[];
}

/**
 * Сводит характеристики из описания прайса и названия в одну структуру.
 * Плашки собираются консервативно: мощность — только явный MAX или число
 * из названия; сопротивление — только из названия (в описаниях усилителей
 * «4 Ом: 260 Вт» — это строка таблицы, а не паспортное сопротивление).
 */
export function fullSpecs(title: string, description?: string[]): ProductSpecs {
  const src = [title, ...(description ?? [])].join(" · ");

  const stats: Spec[] = [];
  /*
    Мощность. Подписанный максимум (хоть «MAX», хоть «Максимальная мощность»)
    берём откуда угодно — и из названия, и из описания. Неподписанное число
    с «Вт» — только из названия: в описаниях рядом стоят номинальная
    мощность, чувствительность и частоты, и первое попавшееся число там
    запросто окажется не тем.
  */
  const code = modelCode(title);
  const amp = isAmplifier(title);
  // Мощность из кода — у сабвуфера и усилителя; у усилителя это RMS на канал.
  const codeW = code && (isSubwoofer(title) || amp) ? code.power : undefined;

  const maxW = powerMaxFrom(src);
  const pTitle = title.match(/(\d{2,5})\s*(?:Вт(?![а-яё])|W\b|BT\b)/i);
  const titleW = pTitle ? parseInt(pTitle[1], 10) : undefined;
  if (maxW !== undefined) {
    stats.push({ label: "Мощность MAX", value: `${maxW} Вт` });
  } else if (codeW !== undefined) {
    // Номинал из кода модели — подпись честная: это RMS, а не пиковая.
    stats.push({ label: "Мощность RMS", value: `${codeW} Вт` });
  } else if (titleW !== undefined && titleW <= POWER_SANITY_W) {
    stats.push({ label: "Мощность", value: `${titleW} Вт` });
  }

  /*
    Каналы усилителя — первое число кода. Только у усилителей и моноблоков:
    у сабвуфера то же место занимает диаметр в дюймах, и «12 каналов» было
    бы неправдой. Ограничение сверху отсекает случайные совпадения — больше
    восьми каналов в автоусилителе не бывает.
  */
  if (amp && !isSubwoofer(title) && code && code.first >= 1 && code.first <= 8) {
    stats.push({
      label: "Каналы",
      value: `${code.first} ${plural(code.first, "канал", "канала", "каналов")}`,
    });
  }

  /*
    Диаметр — только у динамиков и сабвуферов. У усилителя его нет, а в
    описании усилителя стоят габариты корпуса («Размеры: 150×226×66 мм») —
    diameterFrom принял бы 150 мм за диаметр диффузора.
  */
  const tech = amp ? {} : parseTech(title, description);
  const bucket = tech.diameterMm ? diameterBucket(tech.diameterMm) : null;
  if (bucket) {
    stats.push({ label: "Диаметр", value: bucket });
  } else if (!amp && /овал/i.test(title) && /\b690\b|6\s*[x×х]\s*9/i.test(src)) {
    /*
      Овалы. У поставщика на них нет ни диаметра, ни размера: в описании
      «Диаметр - mm» с пустым значением, а то и вовсе нет описания. Размер
      сидит в самом коде модели — SBS-690, US-690, MR-690.

      Берём его только когда в названии прямо написано «овал»: 690 в коде
      овальной колонки — это 6×9 дюймов, общепринятое обозначение в
      автозвуке. Одного числа в артикуле без слова «овал» для такого вывода
      мало, поэтому условие двойное.

      Отдельная подпись «Размер», а не «Диаметр»: у овала диаметра нет, и
      в корзину фильтра по диаметру он не попадает — там размеры круглых
      динамиков, и 6×9 среди них выглядел бы неправдой.

      В сантиметрах пишем 16×23 — так эти овалы называют в рознице и так
      их назвал владелец. Точный перевод 6″ даёт 15,2 см, но продавцы
      считают по посадочной рамке, которая крупнее номинала.
    */
    stats.push({ label: "Размер", value: "6×9″ (16×23 см)" });
  }
  const ohmTitle = title.match(/(?<![\d.,])([124])\s*(?:ом|ohm|om)(?![а-яёa-z])/i);
  if (ohmTitle) stats.push({ label: "Сопротивление", value: `${ohmTitle[1]} Ом` });

  // «300 W» и прайсовая опечатка «300 BT» — приводим к «300 Вт»
  const clean = (s: string) =>
    s.replace(/(\d)\s*(?:BT|W)(?![a-zа-яё])/gi, "$1 Вт").replace(/^["'«]+|["'»]+$/g, "").trim();

  const rows: Spec[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();
  // «Размер» из названия и «Диаметр» из описания — одно и то же поле
  const keyOf = (label: string) => {
    const k = label.toLowerCase();
    return k === "размер" ? "диаметр" : k;
  };
  for (const raw of description ?? []) {
    const line = raw.replace(/^[•\-–\s]+/, "").trim();
    if (line.length < 3) continue;
    // «Ключ: значение» либо «Ключ - значение» (обе формы встречаются в прайсе).
    // В тире-форме ключ без дефисов, а тире может липнуть к слову
    // («Диапозон частот- 60 - 20 000 Гц» → ключ до первого тире).
    const m =
      line.match(/^([^:]{2,40}):\s*(.*)$/) ??
      line.match(/^([^-:–—]{2,40}?)\s*[-–—]\s+(.+)$/);
    if (m) {
      const label = m[1].trim();
      const key = keyOf(label);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ label, value: clean(m[2]) });
    } else {
      notes.push(line);
    }
  }
  // Распознанное из названия — только то, чего в описании не было
  for (const s of parseSpecs(title)) {
    const key = keyOf(s.label);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(s);
    }
  }

  return { stats, rows, notes };
}

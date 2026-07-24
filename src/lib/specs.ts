/*
  Характеристики из названия товара — эвристический парсер v1.
  В данных с витрины нет отдельных полей характеристик, но в title они есть
  («…3200 Лм 5000-6000K 23000Вт… комплект 2 шт»). Достаём то, что распознаём
  уверенно, и показываем чипами. В фазе CMS заменяется реальными полями.
*/

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
  Номинальная мощность из кода модели сабвуфера.

  У поставщика код устроен как «размер в дюймах . мощность»: B-12.750 —
  12″ и 750 Вт номинала, UB-12.350 — 350, TS-15.1100 — 1100. Подтверждено
  владельцем и сходится с единственным описанием, которое в прайсе есть:
  у TS-10.600 указано «Мощность RMS - 600 BT».

  Требуем ровно эту форму — буквы, дефис, одно-два числа размера, точка и
  три-четыре цифры мощности. Артикулы вида MR-6.1 или HE-1000 под неё не
  подходят и мощности не получают.

  ⚠️ Только сабвуферы. Точно так же выглядят коды усилителей — FR-2.1800,
  AB-4.120, M-1.800, — но там первое число это каналы, а не дюймы, и что
  означает второе (мощность на канал или суммарную), из прайса не видно.
  Владелец подтвердил расшифровку для сабвуферов и только для них, поэтому
  усилители под правило не попадают и остаются без плашки.
*/
const MODEL_RMS_RE = /(?:^|[\s+(])[A-Za-zА-Яа-я]{1,3}-\d{1,2}\.(\d{3,4})(?![\d.])/;

function rmsFromModel(title: string): number | undefined {
  if (!/сабвуфер/i.test(title)) return undefined;
  const m = title.match(MODEL_RMS_RE);
  if (!m) return undefined;
  const w = parseInt(m[1], 10);
  return w <= POWER_SANITY_W ? w : undefined;
}

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
  const maxW = powerMaxFrom(src);
  const pTitle = title.match(/(\d{2,5})\s*(?:Вт(?![а-яё])|W\b|BT\b)/i);
  const titleW = pTitle ? parseInt(pTitle[1], 10) : undefined;
  const rmsW = rmsFromModel(title);
  if (maxW !== undefined) {
    stats.push({ label: "Мощность MAX", value: `${maxW} Вт` });
  } else if (rmsW !== undefined) {
    // Номинал из кода модели — подпись честная: это RMS, а не пиковая.
    stats.push({ label: "Мощность RMS", value: `${rmsW} Вт` });
  } else if (titleW !== undefined && titleW <= POWER_SANITY_W) {
    stats.push({ label: "Мощность", value: `${titleW} Вт` });
  }

  const tech = parseTech(title, description);
  const bucket = tech.diameterMm ? diameterBucket(tech.diameterMm) : null;
  if (bucket) {
    stats.push({ label: "Диаметр", value: bucket });
  } else if (/овал/i.test(title) && /\b690\b|6\s*[x×х]\s*9/i.test(src)) {
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

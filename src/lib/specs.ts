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

  // Мощность
  const power = title.match(/(\d{1,6})\s*(?:вт(?![а-яё])|ватт|w\b)/i);
  if (power) add("Мощность", `${power[1]} Вт`);

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

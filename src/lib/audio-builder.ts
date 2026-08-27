import type { Product } from "./types";
import { isInStock } from "./format";

export type AudioGoal = "balanced" | "loud" | "bass";
export type SpeakerSize = "130" | "165" | "200" | "unknown";

export interface AudioBuilderSelection {
  goal: AudioGoal;
  size: SpeakerSize;
  budget: number;
}

export type AudioBuilderProduct = Pick<
  Product,
  "slug" | "title" | "price" | "image" | "inStock" | "stock"
>;

export interface AudioBuilderItem {
  role: string;
  product: AudioBuilderProduct;
}

export interface AudioBuilderRecommendation {
  id: string;
  title: string;
  summary: string;
  items: AudioBuilderItem[];
  total: number;
  budget: number;
  difference: number;
  isOverBudget: boolean;
  assumedSize: Exclude<SpeakerSize, "unknown">;
  needsSizeCheck: boolean;
}

interface Preset {
  id: string;
  goal: AudioGoal;
  size: Exclude<SpeakerSize, "unknown">;
  rank: number;
  title: string;
  summary: string;
  items: Array<{ role: string; slug: string }>;
}

const SLUG = {
  sbs130: "dinamiki-koaksialnye-shirokopolosnye-130sm-sbs-130-445938",
  ac165: "dinamiki-koaksialnye-zeus-ac-165-517978",
  mr130: "dinamiki-estradnye-13sm-v-mashinu-mr-130-056376",
  mr61: "dinamiki-estradnye-16sm-avtomobilnye-mr-6-1-143399",
  mr81: "dinamiki-estradnye-zeus-mr-8-1-20sm",
  he130: "kolonki-estradnye-130mm-dlya-avtomobilya-he-130-053896",
  he612: "kolonki-avtomobilnye-estradnye-165mm-momo-he-612-783658",
  he715: "dinamiki-momo-estradnye-avtomobilnye-16sm-he-715-403655",
  he810: "estradnye-kolonki-20sm-v-mashinu-he-810-916179",
  bonnie: "kolonki-estradnye-avtomobilnye-165mm-bonnie-clyde-534149",
  he815: "dinamiki-estradnye-momo-he-815-20sm",
  ub10250: "sabvufer-avtomobilnyy-ub-10-250-10-dyuymov-328303",
  b12450: "sabvufer-avtomobilnyy-b-12-450-12-dyuymov-839456",
  ts10600: "sabvufer-avtomobilnyy-ts-10-600-10-dyuymov-182054",
  achilles: "sabvufer-avtomobilnyy-achilles-12-dyuymov-902295",
  ab260: "usilitel-avtomobilnyy-ab-2-60-617369",
  ab460: "usilitel-avtomobilnyy-ab-4-60-882001",
  m600: "monoblok-avtomobilnyy-zeus-m-600-611614",
  ab4120: "usilitel-avtomobilnyy-ab-4-120-159023",
  d4400: "usilitel-avtomobilnyy-d-4-400-288535",
  bd5000: "monoblok-avtomobilnyy-bd-5000-1-803288",
  rca: "rca-2-1-kabel-5m-med-123754",
  sc14tc: "kabel-akusticheskiy-sc-14ga-tc-luzhenaya-med-2x2kv-mm-5m-otr-473784",
  rt0: "obzhimnaya-klemma-0-ga-962354",
  terminal: "klemma-akkumulyatora-dlya-avtomobilya-656147",
  kitM082: "ustanovochnyy-komplekt-dlya-2-h-kanalnogo-avtomobilnogo-usil-259457",
  kitM084: "ustanovochnyy-komplekt-dlya-4-kanalnogo-usilitelya-8ga-5-m-272891",
  kitM042: "komplekt-akusticheskih-kabeley-kit-m-042-304350",
  kitM044: "ustanovochnyy-komplekt-dlya-4-kanalnogo-usilitelya-4ga-5-m-777635",
} as const;

const system = (
  id: string,
  goal: AudioGoal,
  size: Preset["size"],
  rank: number,
  title: string,
  summary: string,
  items: Preset["items"],
): Preset => ({ id, goal, size, rank, title, summary, items });

/**
 * Редакторские системы, проверенные по назначению компонентов. Это не обещание
 * физической совместимости с любым автомобилем: посадочное место, проводку и
 * питание перед монтажом всё равно проверяет установщик.
 */
const PRESETS: Preset[] = [
  system("balanced-130-start", "balanced", "130", 1, "Чистый старт 13", "Ровный фронт без лишней нагрузки на бюджет.", [
    { role: "Фронт", slug: SLUG.he130 }, { role: "Усиление", slug: SLUG.ab260 }, { role: "Подключение", slug: SLUG.kitM082 },
  ]),
  system("balanced-165-start", "balanced", "165", 1, "Чистый старт 16", "Сбалансированный фронт для ежедневного прослушивания.", [
    { role: "Фронт", slug: SLUG.he612 }, { role: "Усиление", slug: SLUG.ab260 }, { role: "Подключение", slug: SLUG.kitM082 },
  ]),
  system("balanced-200-start", "balanced", "200", 1, "Чистый старт 20", "Больше рабочей площади и уверенный среднечастотный диапазон.", [
    { role: "Фронт", slug: SLUG.mr81 }, { role: "Усиление", slug: SLUG.ab460 }, { role: "Подключение", slug: SLUG.kitM084 },
  ]),
  system("balanced-130-full", "balanced", "130", 2, "Детальная система 13", "Фронт с запасом усиления и аккуратным низом.", [
    { role: "Фронт", slug: SLUG.he130 }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.ts10600 },
    { role: "Моноблок", slug: SLUG.m600 }, { role: "Питание", slug: SLUG.kitM044 }, { role: "Межблок", slug: SLUG.rca },
  ]),
  system("balanced-165-full", "balanced", "165", 2, "Детальная система 16", "Выразительный фронт и собранный бас без перекоса в громкость.", [
    { role: "Фронт", slug: SLUG.bonnie }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.ts10600 },
    { role: "Моноблок", slug: SLUG.m600 }, { role: "Питание", slug: SLUG.kitM044 }, { role: "Межблок", slug: SLUG.rca },
  ]),
  system("balanced-200-full", "balanced", "200", 2, "Детальная система 20", "Обновлённый 20-см фронт с отдельным басовым звеном.", [
    { role: "Фронт", slug: SLUG.he815 }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.ts10600 },
    { role: "Моноблок", slug: SLUG.m600 }, { role: "Питание", slug: SLUG.kitM044 }, { role: "Межблок", slug: SLUG.rca },
  ]),

  system("loud-130-start", "loud", "130", 1, "Громкий фронт 13", "Компактный эстрадный фронт с отдельным усилением.", [
    { role: "Фронт", slug: SLUG.mr130 }, { role: "Усиление", slug: SLUG.ab260 }, { role: "Подключение", slug: SLUG.kitM082 },
  ]),
  system("loud-165-start", "loud", "165", 1, "Громкий фронт 16", "Две 16-см полосы с четырёхканальным усилителем.", [
    { role: "Фронт", slug: SLUG.mr61 }, { role: "Усиление", slug: SLUG.ab460 }, { role: "Подключение", slug: SLUG.kitM084 },
  ]),
  system("loud-200-start", "loud", "200", 1, "Громкий фронт 20", "20-см эстрадная акустика с хорошим запасом мощности.", [
    { role: "Фронт", slug: SLUG.he810 }, { role: "Усиление", slug: SLUG.ab4120 }, { role: "Подключение", slug: SLUG.kitM044 },
  ]),
  system("loud-130-pro", "loud", "130", 2, "Напористый фронт 13", "Больше контроля и запаса для громкого ежедневного звука.", [
    { role: "Фронт", slug: SLUG.mr130 }, { role: "Усиление", slug: SLUG.d4400 }, { role: "Подключение", slug: SLUG.kitM044 },
  ]),
  system("loud-165-pro", "loud", "165", 2, "Напористый фронт 16", "Чувствительная акустика и мощное четырёхканальное усиление.", [
    { role: "Фронт", slug: SLUG.he715 }, { role: "Усиление", slug: SLUG.d4400 }, { role: "Подключение", slug: SLUG.kitM044 },
  ]),
  system("loud-200-pro", "loud", "200", 2, "Напористый фронт 20", "Новый HE-815 с усилением, которое оставляет запас по динамике.", [
    { role: "Фронт", slug: SLUG.he815 }, { role: "Усиление", slug: SLUG.d4400 }, { role: "Подключение", slug: SLUG.kitM044 },
  ]),
  system("loud-130-max", "loud", "130", 3, "Фронт и бас 13", "Полная громкая система с флагманским сабвуферным звеном.", [
    { role: "Фронт", slug: SLUG.mr130 }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.achilles },
    { role: "Моноблок", slug: SLUG.bd5000 }, { role: "Акустический кабель", slug: SLUG.sc14tc }, { role: "Силовая клемма", slug: SLUG.rt0 }, { role: "Питание", slug: SLUG.kitM044 },
  ]),
  system("loud-165-max", "loud", "165", 3, "Фронт и бас 16", "Полная громкая система с флагманским сабвуферным звеном.", [
    { role: "Фронт", slug: SLUG.he715 }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.achilles },
    { role: "Моноблок", slug: SLUG.bd5000 }, { role: "Акустический кабель", slug: SLUG.sc14tc }, { role: "Силовая клемма", slug: SLUG.rt0 }, { role: "Питание", slug: SLUG.kitM044 },
  ]),
  system("loud-200-max", "loud", "200", 3, "Фронт и бас 20", "HE-815 и флагманское басовое звено для системы без компромиссов.", [
    { role: "Фронт", slug: SLUG.he815 }, { role: "Усилитель фронта", slug: SLUG.d4400 }, { role: "Сабвуфер", slug: SLUG.achilles },
    { role: "Моноблок", slug: SLUG.bd5000 }, { role: "Акустический кабель", slug: SLUG.sc14tc }, { role: "Силовая клемма", slug: SLUG.rt0 }, { role: "Питание", slug: SLUG.kitM044 },
  ]),

  ...(["130", "165", "200"] as const).flatMap((size) => {
    const front = size === "130" ? SLUG.sbs130 : size === "165" ? SLUG.ac165 : SLUG.mr81;
    const midFront = size === "130" ? SLUG.mr130 : size === "165" ? SLUG.he612 : SLUG.he810;
    const maxFront = size === "130" ? SLUG.he130 : size === "165" ? SLUG.he715 : SLUG.he815;
    return [
      system(`bass-${size}-start`, "bass", size, 1, `Первый бас ${size === "130" ? "13" : size === "165" ? "16" : "20"}`, "Доступная система, в которой низ уже чувствуется физически.", [
        { role: "Фронт", slug: front }, { role: "Сабвуфер", slug: SLUG.ub10250 }, { role: "Усиление", slug: SLUG.ab260 },
        { role: "Подключение", slug: SLUG.kitM082 }, { role: "Клемма", slug: SLUG.terminal },
      ]),
      system(`bass-${size}-drive`, "bass", size, 2, `Плотный бас ${size === "130" ? "13" : size === "165" ? "16" : "20"}`, "Более мощное басовое звено и фронт для ежедневной системы.", [
        { role: "Фронт", slug: midFront }, { role: "Сабвуфер", slug: SLUG.b12450 }, { role: "Моноблок", slug: SLUG.m600 },
        { role: "Питание", slug: SLUG.kitM042 }, { role: "Межблок", slug: SLUG.rca },
      ]),
      system(`bass-${size}-max`, "bass", size, 3, `Максимум баса ${size === "130" ? "13" : size === "165" ? "16" : "20"}`, "Флагманское сабвуферное звено, отдельное усиление фронта и полный комплект подключения.", [
        { role: "Фронт", slug: maxFront }, { role: "Усилитель фронта", slug: SLUG.ab4120 }, { role: "Сабвуфер", slug: SLUG.achilles },
        { role: "Моноблок", slug: SLUG.bd5000 }, { role: "Акустический кабель", slug: SLUG.sc14tc }, { role: "Силовая клемма", slug: SLUG.rt0 }, { role: "Питание", slug: SLUG.kitM044 },
      ]),
    ];
  }),
];

function available(product: AudioBuilderProduct): boolean {
  return isInStock(product as Product) !== false;
}

export function buildAudioRecommendation(
  products: AudioBuilderProduct[],
  selection: AudioBuilderSelection,
): AudioBuilderRecommendation | null {
  const assumedSize = selection.size === "unknown" ? "165" : selection.size;
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  const candidates = PRESETS.filter(
    (preset) => preset.goal === selection.goal && preset.size === assumedSize,
  ).flatMap((preset) => {
    const items = preset.items.flatMap((item) => {
      const product = productBySlug.get(item.slug);
      return product && available(product) ? [{ ...item, product }] : [];
    });
    if (items.length !== preset.items.length) return [];
    const total = items.reduce((sum, item) => sum + item.product.price, 0);
    return [{ preset, items, total }];
  });

  if (candidates.length === 0) return null;

  const budget = Math.max(0, Math.round(selection.budget));
  const affordable = candidates.filter((candidate) => candidate.total <= budget);
  const chosen = affordable.length
    ? affordable.sort((a, b) => b.preset.rank - a.preset.rank || b.total - a.total)[0]
    : candidates.sort((a, b) => a.total - b.total)[0];
  const difference = Math.abs(budget - chosen.total);

  return {
    id: chosen.preset.id,
    title: chosen.preset.title,
    summary: chosen.preset.summary,
    items: chosen.items,
    total: chosen.total,
    budget,
    difference,
    isOverBudget: chosen.total > budget,
    assumedSize,
    needsSizeCheck: selection.size === "unknown",
  };
}


export type VehicleMake = "LADA" | "УАЗ" | "ГАЗ";
export type FitmentMethod = "direct" | "adapter" | "modification";
export type SpeakerMountKind = "round" | "oval-6x9" | "horn" | "unknown";

export interface SpeakerMount {
  kind: SpeakerMountKind;
  diameterMm?: number;
  label: string;
}

export interface VehicleSpeakerSlot {
  location: string;
  kind: "round" | "oval-6x9";
  diameterMm?: number;
  method: FitmentMethod;
  note: string;
}

export interface VehicleFitment {
  id: string;
  make: VehicleMake;
  model: string;
  years: string;
  slots: VehicleSpeakerSlot[];
}

const round = (
  location: string,
  diameterMm: number,
  method: FitmentMethod,
  note: string,
): VehicleSpeakerSlot => ({ location, kind: "round", diameterMm, method, note });

const oval = (
  location: string,
  method: FitmentMethod,
  note: string,
): VehicleSpeakerSlot => ({ location, kind: "oval-6x9", method, note });

/**
 * Консервативная база типовых мест популярных российских автомобилей.
 *
 * Источники для первой версии: руководства и каталоги аксессуаров LADA,
 * каталог LECAR (кольца 13/17 см для Vesta, Largus и XRAY), каталоги
 * профильных производителей проставок/подиумов и карты установок.
 * Если источник подтверждает только подиум или кольцо, здесь не ставится
 * `direct`. Глубина корзины, разъём и конкретная комплектация всё равно
 * проверяются установщиком — это отдельно проговаривается покупателю.
 */
export const VEHICLE_FITMENTS: VehicleFitment[] = [
  {
    id: "lada-granta-1",
    make: "LADA",
    model: "Granta I",
    years: "2011–2018",
    slots: [
      round("передние двери", 130, "direct", "Типовой штатный размер — 13 см."),
      round("передние двери", 165, "modification", "Нужны проставки и доработка внутренней части дверной карты."),
      oval("задняя полка, седан/лифтбек", "modification", "Установка после разметки и доработки полки."),
    ],
  },
  {
    id: "lada-granta-fl",
    make: "LADA",
    model: "Granta FL",
    years: "2018–н.в.",
    slots: [
      round("передние двери", 130, "adapter", "Вариант зависит от аудиоподготовки; требуется переходное кольцо и проверка глубины."),
      round("передние двери", 165, "adapter", "Ставится через проставочное кольцо; на части комплектаций требуется подрезка."),
      oval("задняя полка, седан/лифтбек", "modification", "Установка после разметки и доработки полки."),
    ],
  },
  {
    id: "lada-vesta",
    make: "LADA",
    model: "Vesta / Vesta NG",
    years: "2015–н.в.",
    slots: [
      round("передние двери", 165, "adapter", "Нужно модельное проставочное кольцо и переходник штатного разъёма."),
      round("задние двери", 130, "adapter", "Нужно модельное проставочное кольцо; проверьте глубину корзины."),
    ],
  },
  {
    id: "lada-largus",
    make: "LADA",
    model: "Largus",
    years: "2012–н.в.",
    slots: [
      round("передние и задние двери", 130, "direct", "Штатный круглый типоразмер — 13 см; может понадобиться переходник разъёма."),
      round("передние и задние двери", 165, "modification", "Нужны проставки и подрезка части ниши дверной карты."),
    ],
  },
  {
    id: "lada-xray",
    make: "LADA",
    model: "XRAY",
    years: "2015–2022",
    slots: [
      round("передние двери", 165, "adapter", "Нужно модельное проставочное кольцо и проверка глубины."),
      round("задние двери", 130, "adapter", "Установка через модельное проставочное кольцо."),
    ],
  },
  {
    id: "lada-kalina-2",
    make: "LADA",
    model: "Kalina II",
    years: "2013–2018",
    slots: [
      round("передние двери", 130, "adapter", "Установка через модельный подиум или проставку."),
      round("передние двери", 165, "adapter", "Установка через модельный подиум; проверьте глубину магнита."),
      round("задние двери", 130, "adapter", "Установка через модельную проставку."),
    ],
  },
  {
    id: "lada-priora",
    make: "LADA",
    model: "Priora",
    years: "2007–2018",
    slots: [
      round("передние двери", 130, "direct", "Типовой штатный размер — 13 см; проверьте крепёж и глубину."),
      round("передние двери", 165, "modification", "Нужны проставки и доработка дверной карты."),
      oval("задняя полка, седан/хэтчбек", "modification", "Установка после разметки и усиления полки."),
    ],
  },
  {
    id: "lada-niva-travel",
    make: "LADA",
    model: "Niva Travel / Chevrolet Niva",
    years: "2002–н.в.",
    slots: [
      round("передние двери", 165, "adapter", "Нужен модельный подиум под акустику 16–17 см."),
      round("задние места", 130, "adapter", "Потребуется модельная проставка; расположение зависит от комплектации."),
    ],
  },
  {
    id: "lada-niva-legend",
    make: "LADA",
    model: "Niva Legend / 4×4",
    years: "1977–н.в.",
    slots: [
      round("передняя часть салона", 130, "modification", "Унифицированного дверного места нет — нужен подиум или боковая панель."),
      round("передние двери", 165, "modification", "Нужен модельный дверной подиум и прокладка проводки."),
    ],
  },
  {
    id: "lada-2108-21099",
    make: "LADA",
    model: "Самара 2108–21099",
    years: "1984–2011",
    slots: [
      round("передняя панель", 100, "direct", "Типовой размер штатных мест в панели — 10 см; проверьте глубину."),
      round("передние двери", 130, "modification", "Нужны дверные подиумы."),
      oval("задняя полка", "modification", "Нужны разметка, вырез и усиление полки."),
    ],
  },
  {
    id: "lada-samara-2",
    make: "LADA",
    model: "Самара 2 (2113–2115)",
    years: "1997–2013",
    slots: [
      round("передние двери", 130, "direct", "Типовой штатный размер — 13 см; проверьте глубину."),
      round("передние двери", 165, "modification", "Нужны дверные подиумы и локальная доработка."),
      oval("задняя полка", "modification", "Нужны разметка, вырез и усиление полки."),
    ],
  },
  {
    id: "lada-2110",
    make: "LADA",
    model: "Семейство 2110–2112",
    years: "1995–2009",
    slots: [
      round("передние двери", 130, "direct", "Типовой штатный размер — 13 см; проверьте глубину."),
      round("передние двери", 165, "modification", "Нужны дверные подиумы и доработка карты."),
      oval("задняя полка", "modification", "Нужны разметка, вырез и усиление полки."),
    ],
  },
  {
    id: "lada-classic",
    make: "LADA",
    model: "Классика 2101–2107",
    years: "1970–2012",
    slots: [
      round("передняя часть салона", 100, "modification", "Единого дверного места нет — нужны корпуса или подиумы."),
      round("задняя полка", 130, "modification", "Установка после разметки и усиления полки."),
      oval("задняя полка", "modification", "Установка после разметки, выреза и усиления полки."),
    ],
  },
  {
    id: "uaz-patriot",
    make: "УАЗ",
    model: "Patriot",
    years: "2005–н.в.",
    slots: [
      round("передние и задние двери", 130, "direct", "Типовой штатный размер — 13 см; у разных дверных карт отличается глубина."),
      round("передние и задние двери", 165, "modification", "Нужны подиумы и подгонка дверной карты под штатный гриль."),
    ],
  },
  {
    id: "uaz-pickup",
    make: "УАЗ",
    model: "Pickup",
    years: "2008–н.в.",
    slots: [
      round("передние двери", 130, "direct", "Типовой штатный размер — 13 см; проверьте глубину."),
      round("передние двери", 165, "modification", "Нужны подиумы и подгонка дверной карты."),
    ],
  },
  {
    id: "uaz-hunter",
    make: "УАЗ",
    model: "Hunter",
    years: "2003–н.в.",
    slots: [
      round("передняя часть салона", 130, "modification", "Нужны отдельные корпуса или дверные подиумы."),
      round("передние двери", 165, "modification", "Нужны модельные подиумы и прокладка проводки."),
    ],
  },
  {
    id: "gazelle-next",
    make: "ГАЗ",
    model: "ГАЗель Next / NN",
    years: "2013–н.в.",
    slots: [
      round("передние двери", 165, "modification", "Нужен дверной подиум и проверка хода стекла."),
      round("передние двери", 200, "modification", "Только в специальный усиленный подиум; штатной установкой не является."),
    ],
  },
  {
    id: "gazelle-business",
    make: "ГАЗ",
    model: "ГАЗель Бизнес / Соболь",
    years: "2010–н.в.",
    slots: [
      round("передние двери", 130, "modification", "Нужен модельный дверной подиум."),
      round("передние двери", 165, "modification", "Нужен усиленный дверной подиум и проверка хода стекла."),
    ],
  },
];

export const VEHICLE_MAKES: VehicleMake[] = ["LADA", "УАЗ", "ГАЗ"];

/** Размеры 16, 16.5 и 17 см относятся к одному установочному классу. */
function roundSizeMatches(productMm: number, slotMm: number): boolean {
  if (productMm >= 150 && productMm <= 180 && slotMm >= 150 && slotMm <= 180) return true;
  return Math.abs(productMm - slotMm) <= 6;
}

export function detectSpeakerMount(title: string, diameterMm?: number): SpeakerMount {
  if (/рупор/i.test(title)) {
    return { kind: "horn", diameterMm, label: diameterMm ? `${Math.round(diameterMm / 10)} см, рупор` : "рупор" };
  }
  if (/овал|(?:^|[\s-])(?:sbs|mr|us)-?690\b|6\s*[x×х]\s*9/i.test(title)) {
    return { kind: "oval-6x9", label: "овальный 6×9″" };
  }
  if (diameterMm) {
    const cm = diameterMm / 10;
    return {
      kind: "round",
      diameterMm,
      label: `${Number.isInteger(cm) ? cm : cm.toFixed(1).replace(".", ",")} см`,
    };
  }
  return { kind: "unknown", label: "размер не указан" };
}

export function slotMatchesMount(slot: VehicleSpeakerSlot, mount: SpeakerMount): boolean {
  if (mount.kind === "oval-6x9") return slot.kind === "oval-6x9";
  if (mount.kind !== "round" || slot.kind !== "round" || !mount.diameterMm || !slot.diameterMm) return false;
  return roundSizeMatches(mount.diameterMm, slot.diameterMm);
}

export function compatibleVehicleSlots(mount: SpeakerMount) {
  return VEHICLE_FITMENTS.flatMap((vehicle) =>
    vehicle.slots
      .filter((slot) => slotMatchesMount(slot, mount))
      .map((slot) => ({ vehicle, slot })),
  );
}

export function slotSizeLabel(slot: VehicleSpeakerSlot): string {
  if (slot.kind === "oval-6x9") return "6×9″";
  return `${(slot.diameterMm ?? 0) / 10} см`;
}


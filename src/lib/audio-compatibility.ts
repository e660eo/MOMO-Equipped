import type {
  AudioBuilderItem,
  AudioBuilderProduct,
  AudioBuilderRecommendation,
  AudioBuilderSelection,
  AudioGoal,
} from "./audio-builder";
import { parseTech } from "./specs";
import { coilSpec, nominalRms } from "./electrical-specs";
import { isInStock } from "./format";
import type { Product } from "./types";

export type AudioProductKind = "speaker" | "subwoofer" | "amplifier" | "wiring" | "other";

export interface AmplifierOutput {
  ohm: number;
  channels: number;
  wattsPerChannel: number;
}

export interface ParsedAudioSpec {
  kind: AudioProductKind;
  diameterMm?: number;
  rmsW?: number;
  impedanceOhm?: number;
  loadOptions: number[];
  coilLabel?: string;
  coilCount?: number;
  sensitivityDb?: number;
  channels?: number;
  outputs: AmplifierOutput[];
  minImpedanceOhm?: number;
  gauge?: number;
}

const number = (value: string) => Number(value.replace(",", "."));
const source = (product: AudioBuilderProduct) =>
  [product.title, ...(product.description ?? [])].join(" · ");

function productKind(product: AudioBuilderProduct): AudioProductKind {
  if (product.category === "dinamiki-rupora") return "speaker";
  if (product.category === "sabvufery") return "subwoofer";
  if (product.category === "usiliteli-monobloki" && !/^плата(?:\s|$)/i.test(product.title)) return "amplifier";
  if (product.category === "aksessuary" && /кабел|комплект|клемм|предохран|провод/i.test(product.title)) return "wiring";
  return "other";
}

function modelCode(product: AudioBuilderProduct): { first: number; second: number } | null {
  const match = product.title.match(/(?:^|[\s+(])[A-Za-zА-Яа-я]{1,3}-(\d{1,2})\.(\d{2,4})(?!\d)/);
  return match ? { first: Number(match[1]), second: Number(match[2]) } : null;
}

function amplifierChannels(text: string, title: string): number | undefined {
  const explicit = text.match(/(?:кол(?:ичеств[а-яё]*|\-во)\s+канал[а-яё]*|канал[а-яё]*)\s*[:\-–—]?\s*(\d)/i);
  if (explicit) return Number(explicit[1]);
  if (/моноблок/i.test(title)) return 1;
  if (/четыр[её]хканальн/i.test(text)) return 4;
  if (/двухканальн/i.test(text)) return 2;
  return modelCode({ title } as AudioBuilderProduct)?.first;
}

function amplifierOutputs(text: string, channels?: number): AmplifierOutput[] {
  const outputs: AmplifierOutput[] = [];
  const add = (ohm: number, count: number, watts: number) => {
    if (![1, 2, 4].includes(ohm) || count < 1 || watts < 20 || watts > 10_000) return;
    const duplicate = outputs.some((output) => output.ohm === ohm && output.channels === count);
    if (!duplicate) outputs.push({ ohm, channels: count, wattsPerChannel: watts });
  };

  for (const match of text.matchAll(
    /([124])\s*(?:ом|ohm|om)(?:\s*\([^)]*\))?\s*[:\-–—,]?\s*(\d)\s*[×xх]\s*(\d{2,5})\s*(?:вт|w|bt)/gi,
  )) {
    add(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  for (const match of text.matchAll(
    /([124])\s*(?:ом|ohm|om)[^\d]{0,18}(\d{2,5})\s*(?:вт|w|bt)/gi,
  )) {
    add(Number(match[1]), channels ?? 1, Number(match[2]));
  }

  // Minimum supported load does not establish the load at which RMS was measured.
  return outputs.sort((a, b) => a.ohm - b.ohm);
}

export function parseAudioProductSpec(product: AudioBuilderProduct): ParsedAudioSpec {
  const text = source(product);
  const kind = productKind(product);
  const tech = parseTech(product.title, product.description);
  const impedance = coilSpec(text);
  const sensitivity = text.match(/(?:чувствительност[а-яё]*|SPL)\s*[:\-–—]?\s*(\d{2,3}(?:[.,]\d+)?)/i)
    ?? text.match(/(?<![\d.,])(\d{2,3}(?:[.,]\d+)?)\s*(?:дб|db)(?![а-яёa-z])/i);
  const channels = kind === "amplifier" ? amplifierChannels(text, product.title) : undefined;
  const outputs = kind === "amplifier" ? amplifierOutputs(text, channels) : [];
  const minimum = text.match(/минимальн[а-яё]*\s+сопротивлен[а-яё]*(?:\s+нагрузки(?:\s+на\s+канал)?)?\s*[:\-,]?\s*([124])\s*ом/i);
  const rmsW = kind === "speaker" || kind === "subwoofer" ? nominalRms(text) : undefined;

  return {
    kind,
    diameterMm: kind === "speaker" || kind === "subwoofer" ? tech.diameterMm : undefined,
    rmsW,
    impedanceOhm: impedance?.count === 1 ? impedance.coilOhm : undefined,
    loadOptions: impedance?.loads ?? [],
    coilLabel: impedance?.label,
    coilCount: impedance?.count,
    sensitivityDb: sensitivity ? number(sensitivity[1]) : undefined,
    channels,
    outputs,
    minImpedanceOhm: minimum ? Number(minimum[1]) : outputs[0]?.ohm,
    gauge: kind === "wiring" ? Number(product.title.match(/(\d+)\s*GA/i)?.[1]) || undefined : undefined,
  };
}

interface ProductWithSpec {
  product: AudioBuilderProduct;
  spec: ParsedAudioSpec;
}

interface FrontMatch {
  speaker: ProductWithSpec;
  amplifier: ProductWithSpec;
  output: AmplifierOutput;
  ratio: number;
  score: number;
}

interface BassMatch {
  subwoofer: ProductWithSpec;
  amplifier: ProductWithSpec;
  output: AmplifierOutput;
  ratio: number;
  score: number;
}

function speakerGoalScore(item: ProductWithSpec, goal: AudioGoal): number {
  const { product, spec } = item;
  const sensitivity = spec.sensitivityDb ?? 88;
  const rms = spec.rmsW ?? 0;
  const isStage = /эстрад/i.test(product.title);
  const isCoaxial = /коаксиаль|широкополос/i.test(product.title);
  if (goal === "loud") return sensitivity * 1.4 + rms / 4 + (isStage ? 28 : -8);
  if (goal === "bass") return sensitivity * 0.6 + rms / 12 + (isCoaxial ? 12 : 6) - product.price / 1_500;
  return sensitivity + rms / 8 + (isCoaxial ? 20 : 8);
}

function matchScore(ratio: number, target = 1.1): number {
  return Math.max(0, 100 - Math.abs(Math.log(ratio / target)) * 85);
}

function targetDiameter(size: "130" | "165" | "200") {
  if (size === "130") return { min: 120, max: 145 };
  if (size === "165") return { min: 146, max: 180 };
  return { min: 181, max: 220 };
}

function chooseWiring(
  products: ProductWithSpec[],
  gauge: number,
  channels: number,
): ProductWithSpec | undefined {
  return products
    .filter(({ product, spec }) =>
      spec.kind === "wiring"
      && spec.gauge === gauge
      && /установочн[а-яё]*\s+комплект/i.test(product.title),
    )
    .sort((a, b) => {
      const aChannels = new RegExp(`${channels}[-х ]*канальн`, "i").test(a.product.title) ? 1 : 0;
      const bChannels = new RegExp(`${channels}[-х ]*канальн`, "i").test(b.product.title) ? 1 : 0;
      return bChannels - aChannels || a.product.price - b.product.price;
    })[0];
}

function recommendedPower(totalRms: number) {
  const fuseA = Math.ceil(totalRms / (13.8 * 0.75) / 10) * 10;
  const gauge = totalRms <= 450 ? 8 : totalRms <= 1_000 ? 4 : 0;
  return { fuseA, gauge };
}

export function buildAutomaticRecommendation(
  products: AudioBuilderProduct[],
  selection: AudioBuilderSelection,
): AudioBuilderRecommendation | null {
  const assumedSize = selection.size === "unknown" ? "165" : selection.size;
  const diameter = targetDiameter(assumedSize);
  const parsed = products
    .filter((product) => isInStock(product as Product) === true)
    .map((product) => ({ product, spec: parseAudioProductSpec(product) }));

  const speakers = parsed.filter(({ spec }) =>
    spec.kind === "speaker"
    && spec.rmsW
    && spec.impedanceOhm
    && spec.diameterMm
    && spec.diameterMm >= diameter.min
    && spec.diameterMm <= diameter.max,
  );
  const frontAmplifiers = parsed.filter(({ spec }) => spec.kind === "amplifier" && (spec.channels ?? 0) >= 2);
  const frontMatches: FrontMatch[] = [];

  for (const speaker of speakers) {
    for (const amplifier of frontAmplifiers) {
      const output = amplifier.spec.outputs.find(({ ohm, channels }) =>
        ohm === speaker.spec.impedanceOhm && channels >= 2,
      );
      if (!output || !speaker.spec.rmsW) continue;
      const ratio = output.wattsPerChannel / speaker.spec.rmsW;
      if (ratio < 0.65 || ratio > 1.55) continue;
      frontMatches.push({
        speaker,
        amplifier,
        output,
        ratio,
        score: speakerGoalScore(speaker, selection.goal) + matchScore(ratio),
      });
    }
  }
  if (frontMatches.length === 0) return null;

  const subwoofers = parsed.filter(({ spec }) => spec.kind === "subwoofer" && spec.rmsW && spec.loadOptions.length);
  const monoblocks = parsed.filter(({ spec }) => spec.kind === "amplifier" && spec.channels === 1);
  const bassMatches: BassMatch[] = [];
  for (const subwoofer of subwoofers) {
    for (const amplifier of monoblocks) {
      if (!subwoofer.spec.rmsW) continue;
      const possibleOutputs = amplifier.spec.outputs.filter(({ ohm }) => subwoofer.spec.loadOptions.includes(ohm));
      for (const output of possibleOutputs) {
        const ratio = output.wattsPerChannel / subwoofer.spec.rmsW;
        if (ratio < 0.75 || ratio > 1.35) continue;
        bassMatches.push({
          subwoofer,
          amplifier,
          output,
          ratio,
        score: matchScore(ratio, 1.05) + subwoofer.spec.rmsW / 35,
        });
      }
    }
  }

  const rca = parsed
    .filter(({ product }) => /^rca\b/i.test(product.title))
    .sort((a, b) => a.product.price - b.product.price)[0];
  const systems: Array<{
    front: FrontMatch;
    bass?: BassMatch;
    items: AudioBuilderItem[];
    total: number;
    score: number;
    power: ReturnType<typeof recommendedPower>;
  }> = [];

  for (const front of frontMatches) {
    const variants: Array<BassMatch | undefined> = selection.goal === "bass"
      ? bassMatches
      : selection.goal === "balanced" && selection.budget >= 18_000
        ? [undefined, ...bassMatches]
        : [undefined];
    for (const bass of variants) {
      const totalRms = front.output.wattsPerChannel * 2 + (bass?.output.wattsPerChannel ?? 0);
      const power = recommendedPower(totalRms);
      const wiring = power.gauge ? chooseWiring(parsed, power.gauge, front.output.channels) : undefined;
      const items: AudioBuilderItem[] = [
        { role: "Фронт", product: front.speaker.product },
        { role: "Усилитель фронта", product: front.amplifier.product },
      ];
      if (bass) {
        items.push(
          { role: "Сабвуфер", product: bass.subwoofer.product },
          { role: "Моноблок", product: bass.amplifier.product },
        );
      }
      if (wiring) items.push({ role: "Базовое подключение", product: wiring.product });
      if (bass && rca && !/RCA/i.test(wiring?.product.title ?? "")) {
        items.push({ role: "Дополнительный межблок", product: rca.product });
      }
      const total = items.reduce((sum, item) => sum + item.product.price, 0);
      systems.push({
        front,
        bass,
        items,
        total,
        power,
        score: front.score + (bass
          ? selection.goal === "bass"
            ? bass.score + 45
            : matchScore(bass.ratio, 1.05)
              + 42
              - Math.abs((bass.subwoofer.spec.rmsW ?? 500) - 500) / 22
              - ((bass.subwoofer.spec.diameterMm ?? 300) > 320 ? 24 : 0)
          : 0),
      });
    }
  }
  if (systems.length === 0) return null;

  const budget = Math.max(0, Math.round(selection.budget));
  const affordable = systems.filter((system) => system.total <= budget);
  const chosen = affordable.length
    ? affordable.sort((a, b) => b.score - a.score || b.total - a.total)[0]
    : systems.sort((a, b) => a.total - b.total)[0];
  const { front, bass, power } = chosen;
  const frontRatio = Math.round(front.ratio * 100) / 100;
  const checks: AudioBuilderRecommendation["technicalChecks"] = [
    {
      label: "Фронт и усилитель",
      value: `${front.speaker.spec.rmsW} Вт RMS · усилитель ${front.output.wattsPerChannel} Вт/канал при ${front.output.ohm} Ом`,
      status: frontRatio >= 0.8 && frontRatio <= 1.35 ? "ok" : "warning",
    },
    {
      label: "Каналы усиления",
      value: `${front.output.channels} канала · для фронта используются 2`,
      status: "ok",
    },
  ];
  if (bass) {
    checks.push({
      label: "Сабвуфер и моноблок",
      value: `${bass.subwoofer.spec.rmsW} Вт RMS · моноблок ${bass.output.wattsPerChannel} Вт при ${bass.output.ohm} Ом`,
      status: "ok",
    });
    if (bass.subwoofer.spec.coilCount === 2) {
      checks.push({
        label: "Подключение катушек",
        value: `${bass.subwoofer.spec.coilLabel} Ом: ${bass.output.ohm === bass.subwoofer.spec.loadOptions[0] ? "параллельное" : "последовательное"} соединение обеих катушек даёт ${bass.output.ohm} Ом. Подтвердите схему перед монтажом.`,
        status: "warning",
      });
    }
  }
  checks.push({
    label: "Силовая часть",
    value: power.gauge
      ? `${power.gauge} GA · расчётный предохранитель около ${power.fuseA} А`
      : `Нужен комплект 0 GA · расчётный предохранитель около ${power.fuseA} А; готовый комплект не добавлен`,
    status: "warning",
  });
  if (bass) {
    checks.push({
      label: "Разводка питания",
      value: "Для двух усилителей мастер должен подобрать распределитель, заземление и номиналы предохранителей",
      status: "warning",
    });
  }

  const difference = Math.abs(budget - chosen.total);
  if (!chosen.items.some((item) => item.role === "Базовое подключение")) checks.push({ label: "В комплект не входит", value: "Силовая проводка и предохранители: комплект подходящего сечения не найден в наличии. Их стоимость не включена в итог.", status: "warning" });
  checks.push({ label: "Монтаж и комплектность", value: "Количество динамиков в упаковке, крепёж и монтаж подтвердите до покупки. Корпус сабвуфера и работы в стоимость оборудования не входят.", status: "warning" });
  const goalTitle = selection.goal === "loud" ? "Громкий фронт" : selection.goal === "bass" ? "Система с басом" : "Сбалансированная система";

  return {
    id: `auto-${selection.goal}-${assumedSize}-${front.speaker.product.slug}-${bass?.subwoofer.product.slug ?? "front"}`,
    title: `${goalTitle} ${assumedSize === "130" ? "13" : assumedSize === "165" ? "16" : "20"}`,
    summary: "Предварительный подбор по указанным в карточках RMS, сопротивлению и каналам. Ниже перечислены проверки и вопросы для установщика.",
    items: chosen.items,
    total: chosen.total,
    budget,
    difference,
    isOverBudget: chosen.total > budget,
    assumedSize,
    needsSizeCheck: selection.size === "unknown",
    mode: "automatic",
    confidence: 0,
    technicalChecks: checks,
  };
}

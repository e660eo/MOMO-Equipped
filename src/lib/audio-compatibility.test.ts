import { describe, expect, it } from "vitest";
import {
  buildAutomaticRecommendation,
  parseAudioProductSpec,
} from "./audio-compatibility";
import type { AudioBuilderProduct } from "./audio-builder";
import catalog from "../../data/products.json";

const product = (
  slug: string,
  title: string,
  category: string,
  price: number,
  description: string[] = [],
): AudioBuilderProduct => ({
  slug,
  title,
  category,
  price,
  description,
  image: `${slug}.webp`,
  inStock: true,
});

describe("parseAudioProductSpec", () => {
  it("reads speaker RMS, impedance, size and sensitivity", () => {
    const spec = parseAudioProductSpec(product(
      "he-715",
      "Динамики MOMO HE-715 16см",
      "dinamiki-rupora",
      4_000,
      ["Динамики 6.5 С.Ч. (165 мм), 4Om, RMS 150 ВТ, 96 Дб"],
    ));

    expect(spec).toMatchObject({
      kind: "speaker",
      diameterMm: 160,
      rmsW: 150,
      impedanceOhm: 4,
      sensitivityDb: 96,
    });
  });

  it("reads amplifier power for every supported load", () => {
    const spec = parseAudioProductSpec(product(
      "ab-4-120",
      "Усилитель AB-4.120",
      "usiliteli-monobloki",
      6_400,
      [
        "Количество каналов: 4",
        "4 Ом: 4 × 120 Вт · 2 Ом: 4 × 180 Вт · 4 Ом (мост): 2 × 280 Вт",
      ],
    ));

    expect(spec.channels).toBe(4);
    expect(spec.outputs).toContainEqual({ ohm: 4, channels: 4, wattsPerChannel: 120 });
    expect(spec.outputs).toContainEqual({ ohm: 2, channels: 4, wattsPerChannel: 180 });
  });

  it("does not treat an amplifier board as a ready amplifier", () => {
    const spec = parseAudioProductSpec(product(
      "board",
      "Плата на моноблок ZEUS M-1.1100",
      "usiliteli-monobloki",
      3_800,
    ));

    expect(spec.kind).toBe("other");
  });

  it("does not invent RMS from the model number", () => {
    const spec = parseAudioProductSpec(product(
      "b-12-450",
      "Сабвуфер B-12.450 12 дюйм",
      "sabvufery",
      4_900,
    ));

    expect(spec.kind).toBe("subwoofer");
    expect(spec.rmsW).toBeUndefined();
    expect(spec.diameterMm).toBe(305);
  });
});

const automaticCatalog: AudioBuilderProduct[] = [
  product("speaker-150", "Динамики эстрадные 165мм", "dinamiki-rupora", 4_000, [
    "Диаметр - 165 мм", "Импеданс - 4 Ом", "Мощность RMS - 150 Вт", "Чувствительность - 96 дБ",
  ]),
  product("speaker-70", "Динамики коаксиальные 165мм", "dinamiki-rupora", 1_500, [
    "Диаметр - 165 мм", "Импеданс - 4 Ом", "Мощность RMS - 70 Вт", "Чувствительность - 91 дБ",
  ]),
  product("amp-120", "Усилитель AB-4.120", "usiliteli-monobloki", 6_000, [
    "Количество каналов: 4", "4 Ом: 4 × 120 Вт · 2 Ом: 4 × 180 Вт",
  ]),
  product("amp-60", "Усилитель AB-4.60", "usiliteli-monobloki", 3_000, [
    "Количество каналов: 4", "4 Ом: 4 × 60 Вт · 2 Ом: 4 × 90 Вт",
  ]),
  product("sub", "Сабвуфер B-12.450 12 дюйм", "sabvufery", 5_000, ["Мощность RMS — 450 Вт", "Импеданс — 2+2 Ом"]),
  product("mono", "Моноблок M-600", "usiliteli-monobloki", 5_300, [
    "Количество каналов: 1", "4 Ом: 260 Вт · 2 Ом: 450 Вт · 1 Ом: 600 Вт",
  ]),
  product("kit-4", "Установочный комплект для 4-канального усилителя 4GA 5 м", "aksessuary", 2_500),
  product("kit-8", "Установочный комплект для 4-канального усилителя 8GA 5 м", "aksessuary", 1_800),
  product("rca", "Rca 2.1 кабель 5m. медь", "aksessuary", 400),
];

describe("buildAutomaticRecommendation", () => {
  it("selects front components by RMS, load and channels", () => {
    const result = buildAutomaticRecommendation(automaticCatalog, {
      goal: "loud",
      size: "165",
      budget: 20_000,
    });

    expect(result?.mode).toBe("automatic");
    expect(result?.items.map((item) => item.product.slug)).toEqual(
      expect.arrayContaining(["speaker-150", "amp-120"]),
    );
    expect(result?.technicalChecks[0].value).toContain("150 Вт RMS");
    expect(result?.technicalChecks[0].value).toContain("120 Вт/канал при 4 Ом");
    expect(result?.items.map((item) => item.product.slug)).toContain("kit-8");
  });

  it("uses a supported dual-coil load and explains the wiring", () => {
    const result = buildAutomaticRecommendation(automaticCatalog, {
      goal: "bass",
      size: "165",
      budget: 30_000,
    });

    expect(result?.items.map((item) => item.product.slug)).toEqual(
      expect.arrayContaining(["sub", "mono"]),
    );
    expect(result?.technicalChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Подключение катушек", status: "warning" }),
      expect.objectContaining({ label: "Разводка питания", status: "warning" }),
    ]));
    expect(result?.technicalChecks.find((c) => c.label === "Сабвуфер и моноблок")?.value).toContain("при 1 Ом");
    expect(result?.technicalChecks.find((c) => c.label === "Подключение катушек")?.value).toContain("параллельное");
  });

  it("does not pair a 2+2 ohm sub with an amplifier rated only at 2 ohm", () => {
    const incompatible = automaticCatalog.map((p) => p.slug === "mono"
      ? { ...p, description: ["Количество каналов: 1", "2 Ом: 450 Вт"] } : p);
    expect(buildAutomaticRecommendation(incompatible, { goal: "bass", size: "165", budget: 30_000 })).toBeNull();
  });

  it("requires explicit coil data and never maps generic RMS to minimum impedance", () => {
    const unknown = automaticCatalog.map((p) => p.slug === "sub" ? { ...p, description: ["RMS 450 Вт"] } : p);
    expect(buildAutomaticRecommendation(unknown, { goal: "bass", size: "165", budget: 30_000 })).toBeNull();
    expect(parseAudioProductSpec(product("amp", "Моноблок M-1000", "usiliteli-monobloki", 5000,
      ["Номинальная мощность (RMS): 700 Вт", "Минимальное сопротивление: 1 Ом"])).outputs).toEqual([]);
  });

  it("does not add a second RCA when the selected wiring kit already includes it", () => {
    const catalog = automaticCatalog.map((item) =>
      item.slug === "kit-4" ? { ...item, title: `${item.title} RCA` } : item,
    );
    const result = buildAutomaticRecommendation(catalog, {
      goal: "bass",
      size: "165",
      budget: 30_000,
    });

    expect(result?.items.some((item) => item.product.slug === "kit-4")).toBe(true);
    expect(result?.items.some((item) => item.product.slug === "rca")).toBe(false);
  });

  it("does not use a product that is explicitly out of stock", () => {
    const catalog = automaticCatalog.map((item) =>
      item.slug === "speaker-150" ? { ...item, stock: 0 } : item,
    );
    const result = buildAutomaticRecommendation(catalog, {
      goal: "loud",
      size: "165",
      budget: 20_000,
    });

    expect(result?.items.some((item) => item.product.slug === "speaker-150")).toBe(false);
  });
});

const liveCatalog: AudioBuilderProduct[] = (catalog as unknown as Array<AudioBuilderProduct & { hidden?: boolean }>)
  .filter((item) => !item.hidden)
  .map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.category,
    price: item.price,
    image: item.image,
    description: item.description,
    inStock: item.inStock,
    stock: item.stock,
  }));

describe("automatic recommendations on the current catalog", () => {
  it.each([
    { goal: "loud" as const, size: "165" as const, budget: 20_000 },
    { goal: "balanced" as const, size: "200" as const, budget: 35_000 },
  ])("builds a technical system for $goal / $size mm", (selection) => {
    const result = buildAutomaticRecommendation(liveCatalog, selection);

    expect(result?.mode).toBe("automatic");
    expect(result?.items.length).toBeGreaterThanOrEqual(2);
    expect(result?.technicalChecks.length).toBeGreaterThanOrEqual(3);
  });
  it("does not claim a compatible bass system when subwoofer specifications are missing", () => {
    const incomplete = liveCatalog.map((item) => item.category === "sabvufery"
      ? { ...item, description: [] } : item);
    expect(buildAutomaticRecommendation(incomplete, { goal: "bass", size: "165", budget: 30_000 })).toBeNull();
  });
  it("uses the confirmed UB-10.250 dual coils and RMS for bass recommendations", () => {
    const sub = liveCatalog.find((item) => item.slug === "sabvufer-avtomobilnyy-ub-10-250-10-dyuymov-328303")!;
    expect(parseAudioProductSpec(sub)).toMatchObject({
      rmsW: 250, coilCount: 2, coilLabel: "2+2", loadOptions: [1, 4], sensitivityDb: 88,
    });
    const result = buildAutomaticRecommendation(liveCatalog, { goal: "bass", size: "165", budget: 30_000 });
    expect(result?.items.some((item) => item.product.slug === sub.slug)).toBe(true);
    expect(result?.technicalChecks.find((item) => item.label === "Подключение катушек")?.value).toContain("2+2 Ом");
  });
});

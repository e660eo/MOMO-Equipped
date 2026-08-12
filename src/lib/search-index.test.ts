import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchIndex, type SearchHit } from "./search-index";

const hits: SearchHit[] = [
  { slug: "momo-12", title: "Сабвуфер MOMO 12", brand: "MOMO", category: "sabvufery", price: 10000, image: "momo.webp" },
  { slug: "zeus-10", title: "Сабвуфер ZEUS 10", brand: "ZEUS", category: "sabvufery", price: 7000, image: "zeus.webp" },
  { slug: "amp", title: "Моноблок Black Edition", brand: "MOMO", category: "usiliteli-monobloki", price: 15000, image: "amp.webp" },
];

describe("catalogue search", () => {
  const index = buildSearchIndex(hits);

  it("requires at least two characters", () => {
    expect(searchIndex(index, "m")).toEqual({ hits: [], total: 0 });
  });

  it("matches all query words across title and brand", () => {
    const result = searchIndex(index, "momo сабвуфер");
    expect(result.total).toBe(1);
    expect(result.hits[0]?.slug).toBe("momo-12");
  });

  it("reports the full count while respecting the result limit", () => {
    const result = searchIndex(index, "сабвуфер", 1);
    expect(result.total).toBe(2);
    expect(result.hits).toHaveLength(1);
  });
});

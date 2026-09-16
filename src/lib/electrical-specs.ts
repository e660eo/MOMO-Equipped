/** Only explicitly labelled electrical data; model numbers are not specifications. */
export function nominalRms(text: string): number | undefined {
  const match = text.match(/(?:номинальн[а-яё]*\s+(?:выходн[а-яё]*\s+)?мощност[а-яё]*(?:\s*\(RMS[^)]*\))?|(?:мощност[а-яё]*\s*)?RMS)\s*[:\-–—]?\s*(\d{2,5})\s*(?:вт|w|bt)/i);
  return match ? Number(match[1]) : undefined;
}

export function coilSpec(text: string): { label: string; loads: number[]; coilOhm: number; count: number } | undefined {
  const dual = text.match(/(?<![\d.,])([1248])\s*\+\s*([1248])\s*(?:ом|ohm|om)(?![а-яёa-z])/i);
  if (dual) {
    const a = Number(dual[1]);
    const b = Number(dual[2]);
    return { label: `${a}+${b}`, loads: [a * b / (a + b), a + b], coilOhm: a, count: 2 };
  }
  const single = text.match(/(?<![\d.,+])([1248])\s*(?:ом|ohm|om)(?![а-яёa-z])/i);
  if (!single) return undefined;
  const ohm = Number(single[1]);
  return { label: String(ohm), loads: [ohm], coilOhm: ohm, count: 1 };
}

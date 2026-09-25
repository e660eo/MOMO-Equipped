export type CartLine = { slug: string; qty: number };
export type CartMutation = { id: string; mode: "merge" | "patch" | "add"; lines: CartLine[] };

/** Only changed lines are sent, so an idle device cannot overwrite another cart. */
export function cartChanges(before: CartLine[], after: CartLine[]): CartLine[] {
  const previous = new Map(before.map((line) => [line.slug, line.qty]));
  const next = new Map(after.map((line) => [line.slug, line.qty]));
  return [...new Set([...previous.keys(), ...next.keys()])].flatMap((slug) =>
    previous.get(slug) === next.get(slug) ? [] : [{ slug, qty: next.get(slug) ?? 0 }],
  );
}

export function applyCartMutation(lines: CartLine[], mutation: CartMutation): CartLine[] {
  const next = new Map(lines.map((line) => [line.slug, line.qty]));
  for (const line of mutation.lines) {
    const previous = next.get(line.slug) ?? 0;
    const qty = mutation.mode === "merge" ? Math.max(previous, line.qty)
      : mutation.mode === "add" ? Math.min(99, previous + line.qty) : line.qty;
    if (qty === 0) next.delete(line.slug);
    else next.set(line.slug, qty);
  }
  return [...next].map(([slug, qty]) => ({ slug, qty }));
}

export function validCartMutation(value: unknown): value is CartMutation {
  if (!value || typeof value !== "object") return false;
  const input = value as CartMutation;
  return typeof input.id === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(input.id)
    && (input.mode === "merge" || input.mode === "patch" || input.mode === "add")
    && Array.isArray(input.lines) && input.lines.length <= 198
    && input.lines.every((line) => line && typeof line.slug === "string"
      && line.slug.length > 0 && line.slug.length <= 250
      && Number.isSafeInteger(line.qty) && line.qty >= 0 && line.qty <= 99)
    && new Set(input.lines.map((line) => line.slug)).size === input.lines.length;
}

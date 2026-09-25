import { assertWritable, readJson, updateJson } from "./store";
import { applyCartMutation, type CartLine, type CartMutation } from "./cart-sync";

const FILE = "customer-carts.json";
type SavedCart = { customerId: string; lines: CartLine[]; applied: string[] };

function carts(): SavedCart[] {
  try { return readJson<SavedCart[]>(FILE); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function getCustomerCart(customerId: string): CartLine[] {
  return carts().find((cart) => cart.customerId === customerId)?.lines ?? [];
}

export function changeCustomerCart(customerId: string, mutation: CartMutation): CartLine[] {
  assertWritable();
  carts(); // Refuse to overwrite an unreadable existing file.
  const saved = updateJson<SavedCart[]>(FILE, (all) => {
    const cart = all.find((entry) => entry.customerId === customerId)
      ?? { customerId, lines: [], applied: [] };
    if (cart.applied.includes(mutation.id)) return all;
    const lines = applyCartMutation(cart.lines, mutation);
    if (lines.length > 99) throw new Error("В корзине может быть не больше 99 позиций.");
    const updated = { customerId, lines, applied: [...cart.applied, mutation.id].slice(-512) };
    return [...all.filter((entry) => entry.customerId !== customerId), updated];
  });
  return saved.find((cart) => cart.customerId === customerId)?.lines ?? [];
}

export function deleteCustomerCart(customerId: string): void {
  assertWritable();
  if (!carts().some((cart) => cart.customerId === customerId)) return;
  updateJson<SavedCart[]>(FILE, (all) => all.filter((cart) => cart.customerId !== customerId));
}

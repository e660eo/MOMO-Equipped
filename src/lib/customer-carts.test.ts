import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeCustomerCart, deleteCustomerCart, getCustomerCart } from "./customer-carts";
import type { CartMutation } from "./cart-sync";

describe("durable customer carts", () => {
  let dir: string;
  const previous = process.env.MOMO_DATA_DIR;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-carts-test-"));
    process.env.MOMO_DATA_DIR = dir;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const change = (id: string, slug: string, qty: number, mode: CartMutation["mode"] = "patch"): CartMutation => ({ id, mode, lines: [{ slug, qty }] });
  it("preserves unrelated changes from two devices and isolates accounts", () => {
    changeCustomerCart("alice", change("device-one", "sub", 1));
    changeCustomerCart("alice", change("device-two", "amp", 2));
    expect(getCustomerCart("alice")).toEqual([{ slug: "sub", qty: 1 }, { slug: "amp", qty: 2 }]);
    expect(getCustomerCart("bob")).toEqual([]);
  });
  it("does not replay a lost response after another device removes the product", () => {
    const original = change("guest-import", "bundle:kit", 2, "merge");
    changeCustomerCart("alice", original);
    changeCustomerCart("alice", change("remove-kit", "bundle:kit", 0));
    changeCustomerCart("alice", original);
    expect(getCustomerCart("alice").some((item) => item.slug === "bundle:kit")).toBe(false);
  });
  it("combines additions of the same product from separate devices exactly once", () => {
    const first = change("first-add", "sub", 1, "add");
    const second = change("second-add", "sub", 1, "add");
    changeCustomerCart("concurrent", first);
    changeCustomerCart("concurrent", second);
    changeCustomerCart("concurrent", first);
    expect(getCustomerCart("concurrent")).toEqual([{ slug: "sub", qty: 2 }]);
    deleteCustomerCart("concurrent");
  });
  it("merges guest quantities without doubling an existing line", () => {
    changeCustomerCart("bob", change("initial", "sub", 3));
    changeCustomerCart("bob", change("guest-merge", "sub", 1, "merge"));
    expect(getCustomerCart("bob")).toEqual([{ slug: "sub", qty: 3 }]);
  });
  it("removes a deleted account's cart without affecting others", () => {
    deleteCustomerCart("alice");
    expect(getCustomerCart("alice")).toEqual([]);
    expect(getCustomerCart("bob")).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "customer-carts.json"), "utf8"))).toHaveLength(1);
  });
});

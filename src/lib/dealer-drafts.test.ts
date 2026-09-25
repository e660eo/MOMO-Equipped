import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeDealerDraft, getDealerDraft } from "./dealer-drafts";
import type { DealerDraftMutation } from "./dealer-order-draft";

describe("account-bound durable dealer drafts", () => {
  let dir: string;
  const previous = process.env.MOMO_DATA_DIR;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-dealer-drafts-test-"));
    process.env.MOMO_DATA_DIR = dir;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const adjust = (id: string, slug: string, qty: number): DealerDraftMutation => ({ id, mode: "adjust", lines: [{ slug, qty }] });

  it("combines concurrent increments and preserves other devices' lines", () => {
    changeDealerDraft("alice", adjust("desktop-add-sub", "sub", 2));
    changeDealerDraft("alice", adjust("phone-add-sub", "sub", 3));
    changeDealerDraft("alice", adjust("phone-add-amp", "amp", 1));
    expect(getDealerDraft("alice").quantities).toEqual({ sub: 5, amp: 1 });
    expect(getDealerDraft("bob").quantities).toEqual({});
  });
  it("retries a lost response exactly once even after another device removed the line", () => {
    const original = adjust("lost-response", "cable", 2);
    changeDealerDraft("alice", original);
    changeDealerDraft("alice", adjust("remove-cable", "cable", -2));
    changeDealerDraft("alice", original);
    expect(getDealerDraft("alice").quantities.cable).toBeUndefined();
  });
  it("removes only submitted quantities and preserves subsequent comment edits", () => {
    changeDealerDraft("alice", { id: "new-phone-comment", mode: "adjust", lines: [], comment: "Добавить доставку" });
    const consume: DealerDraftMutation = { id: "order-on-desktop", mode: "consume", lines: [{ slug: "sub", qty: 2 }], comment: "Старый комментарий" };
    changeDealerDraft("alice", consume);
    changeDealerDraft("alice", consume);
    expect(getDealerDraft("alice")).toMatchObject({ quantities: { sub: 3, amp: 1 }, comment: "Добавить доставку" });
  });
  it("clears the submitted comment only when it has not changed", () => {
    changeDealerDraft("bob", { id: "comment-for-order", mode: "adjust", lines: [], comment: "Позвонить" });
    changeDealerDraft("bob", { id: "accepted-order", mode: "consume", lines: [], comment: "Позвонить" });
    expect(getDealerDraft("bob").comment).toBe("");
    expect(getDealerDraft("alice").comment).toBe("Добавить доставку");
  });
  it("refuses to replace an unreadable data file", () => {
    const target = path.join(dir, "dealer-drafts.json");
    const previousContent = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, "broken-json", "utf8");
    expect(() => changeDealerDraft("alice", adjust("should-not-write", "sub", 1))).toThrow();
    expect(fs.readFileSync(target, "utf8")).toBe("broken-json");
    fs.writeFileSync(target, previousContent, "utf8");
  });
});

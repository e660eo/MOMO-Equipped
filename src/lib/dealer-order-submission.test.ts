import { describe, expect, it } from "vitest";
import { parseDealerOrderSubmission } from "./dealer-order-submission";

function form(items: unknown = [{ slug: "a", qty: 2 }]) {
  const form = new FormData();
  form.set("requestId", "aaaaaaaa-bbbb-cccc-dddd-111111111111");
  form.set("items", JSON.stringify(items));
  form.set("quotedPrices", JSON.stringify({ a: 10.25, b: 20 }));
  return form;
}
describe("dealer order request identity", () => {
  it("normalizes ordering and aggregates repeated rows for a stable fingerprint", () => {
    const first = parseDealerOrderSubmission(form([{ slug: "a", qty: 1 }, { slug: "b", qty: 2 }, { slug: "a", qty: 2 }]));
    const second = parseDealerOrderSubmission(form([{ slug: "a", qty: 3 }, { slug: "b", qty: 2 }]));
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.items).toEqual([{ slug: "a", qty: 3, quotedPrice: 10.25 }, { slug: "b", qty: 2, quotedPrice: 20 }]);
  });
  it("changes identity when quantities, comment or the reviewed price changes", () => {
    const original = parseDealerOrderSubmission(form()).fingerprint;
    expect(parseDealerOrderSubmission(form([{ slug: "a", qty: 3 }])).fingerprint).not.toBe(original);
    const withComment = form(); withComment.set("comment", "Доставка до склада");
    expect(parseDealerOrderSubmission(withComment).fingerprint).not.toBe(original);
    const repriced = form(); repriced.set("quotedPrices", '{"a":11}');
    expect(parseDealerOrderSubmission(repriced).fingerprint).not.toBe(original);
  });
  it.each([null, [], [{ slug: "a", qty: 999 }, { slug: "a", qty: 1 }], [null], [{ slug: "a", qty: 0.5 }]])("rejects invalid or excessive quantities %j", (items) => {
    expect(() => parseDealerOrderSubmission(form(items))).toThrow();
  });
  it("requires a request token and the prices shown to the dealer", () => {
    const noId = form(); noId.delete("requestId");
    const noPrices = form(); noPrices.delete("quotedPrices");
    expect(() => parseDealerOrderSubmission(noId)).toThrow();
    expect(() => parseDealerOrderSubmission(noPrices)).toThrow();
  });
});

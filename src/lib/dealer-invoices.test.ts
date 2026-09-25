import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDealerInvoice, saveDealerInvoice } from "./dealer-invoices";

let temporary = "";
let previousDir: string | undefined;
beforeEach(() => {
  previousDir = process.env.MOMO_DATA_DIR;
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "momo-private-invoice-"));
  process.env.MOMO_DATA_DIR = temporary;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.MOMO_DATA_DIR;
  else process.env.MOMO_DATA_DIR = previousDir;
  fs.rmSync(temporary, { recursive: true, force: true });
});

describe("private dealer invoices", () => {
  it("stores a PDF outside public uploads with a random name", async () => {
    const file = new File(["%PDF-1.7\nprivate test\n%%EOF"], "../../Счёт.pdf", { type: "application/pdf" });
    const invoice = await saveDealerInvoice(file);
    expect(invoice.originalName).toBe("Счёт.pdf");
    expect(readDealerInvoice(invoice).toString()).toContain("private test");
    expect(fs.existsSync(path.join(temporary, "dealer-invoices", `${invoice.id}.pdf`))).toBe(true);
    expect(fs.existsSync(path.join(temporary, "uploads", `${invoice.id}.pdf`))).toBe(false);
  });

  it("rejects disguised files, traversal ids, and oversized PDFs", async () => {
    await expect(saveDealerInvoice(new File(["<script>not pdf</script>"], "invoice.pdf"))).rejects.toThrow("не является PDF");
    await expect(saveDealerInvoice(new File(["%PDF-1.7"], "invoice.html"))).rejects.toThrow("формате PDF");
    await expect(saveDealerInvoice(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "invoice.pdf"))).rejects.toThrow("не более 5 МБ");
    expect(() => readDealerInvoice({ id: "../dealer-accounts", originalName: "x.pdf", uploadedAt: "now", size: 10 })).toThrow("Invalid invoice id");
  });
});

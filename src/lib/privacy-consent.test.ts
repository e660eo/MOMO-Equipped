import { describe, expect, it } from "vitest";
import { captureConsent, consentFromForm } from "./privacy-consent";
import { CONSENT_VERSION, consentSubmission } from "./privacy-documents";

describe("server consent evidence", () => {
  it.each([undefined, null, true, {}, { accepted: false, version: CONSENT_VERSION },
    { accepted: "true", version: CONSENT_VERSION }, { accepted: true, version: "old" }])
    ("rejects absent, false and obsolete consent: %j", (value) => {
      expect(() => captureConsent(value, "order")).toThrow();
    });
  it("records the server time, purpose and complete immutable document", () => {
    const before = Date.now();
    const evidence = captureConsent(consentSubmission(), "order");
    expect(evidence).toMatchObject({ purpose: "order", version: CONSENT_VERSION });
    expect(Date.parse(evidence.acceptedAt)).toBeGreaterThanOrEqual(before);
    expect(evidence.document).toContain("Махмудов");
    expect(evidence.document).toContain("mail@momo-eq.ru");
    expect(evidence.document.length).toBeGreaterThan(500);
  });
  it("does not accept a checked form without the current document version", () => {
    const form = new FormData();
    form.set("consent", "on");
    expect(() => consentFromForm(form, "dealer")).toThrow();
    form.set("consentVersion", CONSENT_VERSION);
    expect(consentFromForm(form, "dealer").purpose).toBe("dealer");
  });
});

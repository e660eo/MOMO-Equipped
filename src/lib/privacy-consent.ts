import { CONSENT_VERSION, consentDocument, type ConsentEvidence, type ConsentPurpose } from "./privacy-documents";
import { ExpectedError } from "./errors";

export function captureConsent(input: unknown, purpose: ConsentPurpose): ConsentEvidence {
  const value = input as { accepted?: unknown; version?: unknown } | null;
  if (!value || value.accepted !== true) throw new ExpectedError("Подтвердите отдельное согласие на обработку данных.");
  if (value.version !== CONSENT_VERSION) throw new ExpectedError("Редакция согласия обновилась. Обновите страницу и ознакомьтесь с ней повторно.");
  const document = consentDocument(purpose);
  return { purpose, version: CONSENT_VERSION, acceptedAt: new Date().toISOString(), document: [document.title, ...document.paragraphs].join("\n\n") };
}
export function consentFromForm(form: FormData, purpose: ConsentPurpose): ConsentEvidence {
  return captureConsent({ accepted: form.get("consent") === "on", version: form.get("consentVersion") }, purpose);
}

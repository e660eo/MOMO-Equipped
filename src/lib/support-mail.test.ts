import { describe, expect, it } from "vitest";
import { buildSupportMessageLetter } from "./support-mail";
import type { SupportChatMessage, SupportConversation } from "./types";

const message: SupportChatMessage = {
  id: "message-1",
  author: "visitor",
  text: "Есть <усилитель> & доставка?",
  createdAt: "2026-09-01T09:00:00.000Z",
};

const conversation: SupportConversation = {
  id: "CHAT-260901-ABC123",
  visitorTokenHash: "hash",
  name: "Николай",
  contact: "buyer@example.com",
  status: "open",
  createdAt: message.createdAt,
  updatedAt: message.createdAt,
  messages: [message],
};

describe("support message mail", () => {
  it("links directly to the chat and includes the visitor details", () => {
    const letter = buildSupportMessageLetter(conversation, message);

    expect(letter.subject).toBe("Новое сообщение в чате — Николай");
    expect(letter.replyTo).toBe("buyer@example.com");
    expect(letter.text).toContain("Есть <усилитель> & доставка?");
    expect(letter.text).toContain("/admin/messages?chat=CHAT-260901-ABC123");
    expect(letter.html).toContain("Есть &lt;усилитель&gt; &amp; доставка?");
  });

  it("does not use a phone number as Reply-To", () => {
    const letter = buildSupportMessageLetter(
      { ...conversation, contact: "+7 900 000-00-00" },
      message,
    );

    expect(letter.replyTo).toBeUndefined();
  });
});

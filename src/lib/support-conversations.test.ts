import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addAdminSupportReply,
  addVisitorSupportMessage,
  findPublicSupportConversation,
  isSupportConversationWaiting,
  setSupportConversationStatus,
  toPublicSupportConversation,
} from "./support-conversations";
import type { SupportConversation } from "./types";

const conversation: SupportConversation = {
  id: "CHAT-260817-ABC123",
  visitorTokenHash: "secret-hash",
  customerId: "customer-1",
  name: "Иван",
  contact: "ivan@example.com",
  status: "open",
  createdAt: "2026-08-17T06:00:00.000Z",
  updatedAt: "2026-08-17T06:01:00.000Z",
  messages: [
    {
      id: "message-1",
      author: "visitor",
      text: "Нужна помощь с подбором",
      createdAt: "2026-08-17T06:01:00.000Z",
    },
  ],
};

describe("support conversations", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-support-test-"));
    previousDataDir = process.env.MOMO_DATA_DIR;
    process.env.MOMO_DATA_DIR = tempDir;
  });

  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.MOMO_DATA_DIR;
    else process.env.MOMO_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not expose the contact, customer id or token hash to the visitor", () => {
    expect(toPublicSupportConversation(conversation)).toEqual({
      id: conversation.id,
      status: "open",
      messages: conversation.messages,
    });
  });

  it("waits for an admin reply only when the last message is from the visitor", () => {
    expect(isSupportConversationWaiting(conversation)).toBe(true);
    expect(
      isSupportConversationWaiting({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: "message-2",
            author: "admin",
            text: "Поможем",
            createdAt: "2026-08-17T06:02:00.000Z",
          },
        ],
      }),
    ).toBe(false);
    expect(isSupportConversationWaiting({ ...conversation, status: "closed" })).toBe(false);
  });

  it("persists a visitor message, an admin reply and the closed status", () => {
    const token = "9adf46e3-dff4-4eb6-b167-ccb63c2449c1";
    const created = addVisitorSupportMessage({
      token,
      name: "Анна",
      contact: "+7 900 000-00-00",
      text: "Подскажите по усилителю",
    });
    expect(created.messages.at(-1)?.author).toBe("visitor");

    const replied = addAdminSupportReply(created.id, "Поможем подобрать модель");
    expect(replied?.messages.at(-1)?.author).toBe("admin");
    expect(findPublicSupportConversation(token)?.messages).toHaveLength(2);

    expect(setSupportConversationStatus(created.id, "closed")?.status).toBe("closed");
    expect(findPublicSupportConversation(token)?.status).toBe("closed");
  });
});

import crypto from "node:crypto";
import { audit } from "./audit-log";
import { ExpectedError } from "./errors";
import { assertWritable, readJson, updateJson } from "./store";
import type {
  PublicSupportConversation,
  SupportChatMessage,
  SupportConversation,
  SupportConversationStatus,
} from "./types";

const FILE = "support-conversations.json";
const MAX_MESSAGES = 500;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, limit: number): string {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, limit)
    : "";
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(`support:${token}`).digest("hex");
}

function validToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

function conversationId(): string {
  const day = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `CHAT-${day}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function message(author: SupportChatMessage["author"], text: string): SupportChatMessage {
  return {
    id: crypto.randomUUID(),
    author,
    text,
    createdAt: new Date().toISOString(),
  };
}

export function getSupportConversations(): SupportConversation[] {
  try {
    return readJson<SupportConversation[]>(FILE)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getSupportConversation(id: string): SupportConversation | undefined {
  return getSupportConversations().find((conversation) => conversation.id === id);
}

export function toPublicSupportConversation(
  conversation: SupportConversation,
): PublicSupportConversation {
  return {
    id: conversation.id,
    status: conversation.status,
    messages: conversation.messages,
  };
}

export function findPublicSupportConversation(token: unknown): PublicSupportConversation | null {
  if (!validToken(token)) return null;
  const hash = tokenHash(token);
  const conversation = getSupportConversations().find(
    (item) => item.visitorTokenHash === hash,
  );
  return conversation ? toPublicSupportConversation(conversation) : null;
}

export function addVisitorSupportMessage(input: {
  token: unknown;
  name?: unknown;
  contact?: unknown;
  text: unknown;
  customerId?: string;
}): PublicSupportConversation {
  if (!validToken(input.token)) throw new ExpectedError("Обновите страницу и попробуйте ещё раз.");

  const text = clean(input.text, 2_000);
  if (!text) throw new ExpectedError("Напишите сообщение.");

  const hash = tokenHash(input.token);
  const now = new Date().toISOString();
  let result: SupportConversation | undefined;
  let created = false;

  assertWritable();
  updateJson<SupportConversation[]>(FILE, (all) => {
    const index = all.findIndex((item) => item.visitorTokenHash === hash);
    if (index >= 0) {
      const current = all[index];
      if (current.messages.length >= MAX_MESSAGES) {
        throw new ExpectedError(
          "Диалог достиг лимита. Позвоните нам или напишите на email поддержки.",
        );
      }
      result = {
        ...current,
        status: "open",
        updatedAt: now,
        messages: [...current.messages, message("visitor", text)],
      };
      return all.map((item, itemIndex) => (itemIndex === index ? result! : item));
    }

    const name = clean(input.name, 120);
    const contact = clean(input.contact, 160);
    if (name.length < 2) throw new ExpectedError("Укажите имя.");
    if (contact.length < 5) throw new ExpectedError("Укажите телефон или email для связи.");

    created = true;
    result = {
      id: conversationId(),
      visitorTokenHash: hash,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      name,
      contact,
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [message("visitor", text)],
    };
    return [result, ...all];
  });

  if (!result) throw new Error("Support conversation was not written");
  if (created) {
    // Диалог уже записан. Сбой вспомогательного журнала не должен просить
    // посетителя отправить тот же вопрос повторно и создавать дубль.
    try {
      audit({
        entity: "support",
        entityId: result.id,
        action: "conversation_created",
        summary: `Новое обращение в поддержку: ${result.name}`,
        actor: "Посетитель сайта",
      });
    } catch (error) {
      console.error(`Диалог ${result.id}: не удалось записать событие в журнал`, error);
    }
  }
  return toPublicSupportConversation(result);
}

export function addAdminSupportReply(id: string, rawText: unknown): SupportConversation | null {
  const text = clean(rawText, 2_000);
  if (!text) throw new ExpectedError("Напишите ответ.");

  let result: SupportConversation | undefined;
  assertWritable();
  updateJson<SupportConversation[]>(FILE, (all) =>
    all.map((conversation) => {
      if (conversation.id !== id) return conversation;
      if (conversation.messages.length >= MAX_MESSAGES) {
        throw new ExpectedError("Диалог достиг лимита сообщений.");
      }
      result = {
        ...conversation,
        status: "open",
        updatedAt: new Date().toISOString(),
        messages: [...conversation.messages, message("admin", text)],
      };
      return result;
    }),
  );

  if (result) {
    try {
      audit({
        entity: "support",
        entityId: result.id,
        action: "conversation_replied",
        summary: `Отправлен ответ в диалог ${result.id}`,
      });
    } catch (error) {
      console.error(`Диалог ${result.id}: не удалось записать ответ в журнал`, error);
    }
  }
  return result ?? null;
}

export function setSupportConversationStatus(
  id: string,
  status: SupportConversationStatus,
): SupportConversation | null {
  let result: SupportConversation | undefined;
  assertWritable();
  updateJson<SupportConversation[]>(FILE, (all) =>
    all.map((conversation) => {
      if (conversation.id !== id) return conversation;
      result = { ...conversation, status, updatedAt: new Date().toISOString() };
      return result;
    }),
  );
  if (result) {
    try {
      audit({
        entity: "support",
        entityId: result.id,
        action: `conversation_${status}`,
        summary: `${status === "closed" ? "Закрыт" : "Открыт"} диалог ${result.id}`,
      });
    } catch (error) {
      console.error(`Диалог ${result.id}: не удалось записать статус в журнал`, error);
    }
  }
  return result ?? null;
}

export function isSupportConversationWaiting(conversation: SupportConversation): boolean {
  return (
    conversation.status === "open" &&
    conversation.messages.at(-1)?.author === "visitor"
  );
}

export function countWaitingSupportConversations(): number {
  return getSupportConversations().filter(isSupportConversationWaiting).length;
}

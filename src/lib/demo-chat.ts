"use client";

import {
  defaultAutoReplyKnowledge,
  findKnowledgeMatch,
  normalizeKnowledgeItem,
  type AutoReplyKnowledgeItem,
} from "@/lib/auto-reply-knowledge";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: "guest" | "staff" | "admin";
  senderName: string;
  body: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const storageKey = "bolihon-demo-chats";
const knowledgeStorageKey = "bolihon-auto-reply-knowledge";
let memoryConversations: ChatConversation[] = [];
let memoryKnowledge: AutoReplyKnowledgeItem[] = [...defaultAutoReplyKnowledge];

const autoReplySender = {
  role: "staff" as const,
  name: "BOLIHON auto-reply",
};

export function getConversations() {
  if (typeof window === "undefined") return memoryConversations;

  try {
    const stored = window.localStorage.getItem(storageKey);
    memoryConversations = stored ? (JSON.parse(stored) as ChatConversation[]) : memoryConversations;
    return memoryConversations;
  } catch {
    return memoryConversations;
  }
}

export function getChatStats() {
  const today = new Date().toISOString().slice(0, 10);
  const guestMessages = getConversations().flatMap((conversation) =>
    conversation.messages.filter((message) => message.senderRole === "guest"),
  );

  return {
    today: guestMessages.filter((message) => message.createdAt.slice(0, 10) === today).length,
    total: guestMessages.length,
  };
}

export function getCachedAutoReplyKnowledge() {
  if (typeof window === "undefined") return memoryKnowledge;

  try {
    const stored = window.localStorage.getItem(knowledgeStorageKey);
    memoryKnowledge = stored ? (JSON.parse(stored) as AutoReplyKnowledgeItem[]).map(normalizeKnowledgeItem) : memoryKnowledge;
    return memoryKnowledge;
  } catch {
    return memoryKnowledge;
  }
}

export async function refreshAutoReplyKnowledge() {
  try {
    const response = await fetch("/api/auto-reply-knowledge", { cache: "no-store" });
    const data = (await response.json()) as { items?: AutoReplyKnowledgeItem[] };
    if (!response.ok || !Array.isArray(data.items)) return getCachedAutoReplyKnowledge();

    memoryKnowledge = data.items.map(normalizeKnowledgeItem);
    saveAutoReplyKnowledge(memoryKnowledge);
    return memoryKnowledge;
  } catch {
    return getCachedAutoReplyKnowledge();
  }
}

export function getOrCreateConversation(guest: {
  id: string;
  name: string;
  email: string;
  phone: string;
}) {
  const current = getConversations();
  const existing = current.find((conversation) => conversation.id === guest.id);
  if (existing) return existing;

  const conversation: ChatConversation = {
    id: guest.id,
    guestName: guest.name,
    guestEmail: guest.email,
    guestPhone: guest.phone,
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  saveConversations([conversation, ...current]);
  return conversation;
}

export function addMessage(
  conversationId: string,
  sender: { role: "guest" | "staff" | "admin"; name: string },
  body: string,
) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const now = new Date().toISOString();
  const conversations = getConversations().map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    const guestMessage: ChatMessage = {
      id: createMessageId(),
      conversationId,
      senderRole: sender.role,
      senderName: sender.name,
      body: trimmed,
      createdAt: now,
    };
    const messages = [...conversation.messages, guestMessage];

    if (sender.role === "guest") {
      messages.push({
        id: createMessageId(),
        conversationId,
        senderRole: autoReplySender.role,
        senderName: autoReplySender.name,
        body: buildAutomatedReply(trimmed, conversation),
        createdAt: new Date().toISOString(),
      });
    }

    return {
      ...conversation,
      updatedAt: messages.at(-1)?.createdAt || now,
      messages,
    };
  });

  saveConversations(conversations);
}

function createMessageId() {
  return `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAutomatedReply(message: string, conversation: ChatConversation) {
  const greeting = `Hi ${conversation.guestName || "there"}, thanks for messaging BOLIHON Cove.`;
  const match = findKnowledgeMatch(message, getCachedAutoReplyKnowledge());

  if (match) return `${greeting} ${match.response}`;

  return `${greeting} We received your inquiry and an admin will follow up here. For faster help, please include your preferred cottage, dates, number of guests, and contact number.`;
}

function saveConversations(conversations: ChatConversation[]) {
  memoryConversations = conversations;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(conversations));
  } catch {
    // Keep the in-memory chat usable on browsers that block localStorage.
  }

  window.dispatchEvent(new Event("bolihon-chat-updated"));
}

function saveAutoReplyKnowledge(items: AutoReplyKnowledgeItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(knowledgeStorageKey, JSON.stringify(items));
  } catch {
    // Auto-replies can still use the in-memory knowledge for this page session.
  }
}

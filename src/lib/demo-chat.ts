"use client";

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
let memoryConversations: ChatConversation[] = [];

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
  const conversations = getConversations().map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          updatedAt: now,
          messages: [
            ...conversation.messages,
            {
              id: `MSG-${Date.now()}`,
              conversationId,
              senderRole: sender.role,
              senderName: sender.name,
              body: trimmed,
              createdAt: now,
            },
          ],
        }
      : conversation,
  );

  saveConversations(conversations);
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

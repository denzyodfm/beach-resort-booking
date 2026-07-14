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
  const text = message.toLowerCase();
  const greeting = `Hi ${conversation.guestName || "there"}, thanks for messaging BOLIHON Cove.`;

  if (matchesAny(text, ["available", "availability", "vacant", "date", "book", "reserve", "reservation"])) {
    return `${greeting} For availability, please choose your cottage and dates on the booking page so we can check the calendar right away. If you already sent your dates, admin will review this chat and confirm the next step.`;
  }

  if (matchesAny(text, ["rate", "rates", "price", "cost", "how much", "fee"])) {
    return `${greeting} Current daily rates start at Php700 for Cove cottages, Php800 for Rock and RD cottages, Php4,500 for VGP Hall, and Php3,500 for the Pavillon. Final totals depend on cottage and dates.`;
  }

  if (matchesAny(text, ["pay", "payment", "deposit", "gcash", "paid", "proof", "receipt"])) {
    return `${greeting} Please keep your payment proof ready. Admin will verify the payment status and update your booking once the proof has been checked.`;
  }

  if (matchesAny(text, ["cancel", "refund", "reschedule", "move", "change date"])) {
    return `${greeting} For cancellations or date changes, please include your booking ID, contact number, and preferred new date if rescheduling. Admin will check the policy and availability.`;
  }

  if (matchesAny(text, ["where", "location", "address", "directions", "map"])) {
    return `${greeting} Please send your preferred travel date and contact number here. Admin can share the latest directions and arrival details for your visit.`;
  }

  return `${greeting} We received your inquiry and an admin will follow up here. For faster help, please include your preferred cottage, dates, number of guests, and contact number.`;
}

function matchesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
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

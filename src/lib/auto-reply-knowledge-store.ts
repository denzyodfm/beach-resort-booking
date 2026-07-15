import {
  defaultAutoReplyKnowledge,
  normalizeKnowledgeItem,
  type AutoReplyKnowledgeItem,
} from "@/lib/auto-reply-knowledge";

let serverKnowledge = [...defaultAutoReplyKnowledge];

export function getServerAutoReplyKnowledge() {
  return serverKnowledge;
}

export function upsertServerAutoReplyKnowledge(item: AutoReplyKnowledgeItem) {
  const normalized = normalizeKnowledgeItem(item);
  const index = serverKnowledge.findIndex((current) => current.id === normalized.id);

  if (index >= 0) {
    serverKnowledge = serverKnowledge.map((current) => (current.id === normalized.id ? normalized : current));
  } else {
    serverKnowledge = [...serverKnowledge, normalized];
  }

  return normalized;
}

export function deleteServerAutoReplyKnowledge(id: string) {
  const initialLength = serverKnowledge.length;
  serverKnowledge = serverKnowledge.filter((item) => item.id !== id);
  return serverKnowledge.length !== initialLength;
}

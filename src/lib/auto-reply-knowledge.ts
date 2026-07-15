export type AutoReplyKnowledgeItem = {
  id: string;
  title: string;
  keywords: string[];
  response: string;
  sortOrder: number;
  updatedAt: string;
};

export const defaultAutoReplyKnowledge: AutoReplyKnowledgeItem[] = [
  {
    id: "default-availability",
    title: "Availability and reservations",
    keywords: ["available", "availability", "vacant", "date", "book", "reserve", "reservation"],
    response:
      "For availability, please choose your cottage and dates on the booking page so we can check the calendar right away. If you already sent your dates, admin will review this chat and confirm the next step.",
    sortOrder: 10,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "default-rates",
    title: "Cottage rates",
    keywords: ["rate", "rates", "price", "cost", "how much", "fee"],
    response:
      "Current daily rates start at Php700 for Cove cottages, Php800 for Rock and RD cottages, Php4,500 for VGP Hall, and Php3,500 for the Pavillon. Final totals depend on cottage and dates.",
    sortOrder: 20,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "default-payment",
    title: "Payment verification",
    keywords: ["pay", "payment", "deposit", "gcash", "paid", "proof", "receipt"],
    response:
      "Please keep your payment proof ready. Admin will verify the payment status and update your booking once the proof has been checked.",
    sortOrder: 30,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "default-changes",
    title: "Cancellations and date changes",
    keywords: ["cancel", "refund", "reschedule", "move", "change date"],
    response:
      "For cancellations or date changes, please include your booking ID, contact number, and preferred new date if rescheduling. Admin will check the policy and availability.",
    sortOrder: 40,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "default-location",
    title: "Location and directions",
    keywords: ["where", "location", "address", "directions", "map"],
    response:
      "Please send your preferred travel date and contact number here. Admin can share the latest directions and arrival details for your visit.",
    sortOrder: 50,
    updatedAt: new Date(0).toISOString(),
  },
];

export function normalizeKnowledgeItem(row: AutoReplyKnowledgeItem | Record<string, unknown>): AutoReplyKnowledgeItem {
  const source = row as Record<string, unknown>;
  const rawKeywords = source.keywords;

  return {
    id: String(source.id || `knowledge-${Date.now()}`),
    title: String(source.title || "Resort information"),
    keywords: Array.isArray(rawKeywords)
      ? rawKeywords.map(String).map((keyword) => keyword.trim()).filter(Boolean)
      : String(rawKeywords || "")
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
    response: String(source.response || ""),
    sortOrder: Number(source.sortOrder ?? source.sort_order ?? 0),
    updatedAt: String(source.updatedAt || source.updated_at || new Date().toISOString()),
  };
}

export function findKnowledgeMatch(message: string, items: AutoReplyKnowledgeItem[]) {
  const text = message.toLowerCase();
  const scored = items
    .filter((item) => item.response.trim())
    .map((item) => {
      const titleMatch = item.title && text.includes(item.title.toLowerCase()) ? 1 : 0;
      const keywordMatches = item.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;

      return {
        item,
        score: titleMatch + keywordMatches,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.item.sortOrder - b.item.sortOrder);

  return scored[0]?.item || null;
}

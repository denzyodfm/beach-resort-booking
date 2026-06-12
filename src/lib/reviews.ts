import type { Review } from "@/lib/types";

export function normalizeReview(row: Review | Record<string, unknown>): Review {
  const source = row as Record<string, unknown>;
  const room = source.rooms as { name?: string } | undefined;

  return {
    id: String(source.id || ""),
    roomId: String(source.roomId || source.room_id || ""),
    roomName: String(source.roomName || room?.name || "Cottage"),
    guestName: String(source.guestName || source.guest_name || "Guest"),
    guestEmail: String(source.guestEmail || source.guest_email || ""),
    rating: Number(source.rating || 5),
    title: String(source.title || ""),
    body: String(source.body || ""),
    status: Boolean(source.status === "published" || source.is_published) ? "published" : "pending",
    createdAt: String(source.createdAt || source.created_at || new Date().toISOString()),
  };
}

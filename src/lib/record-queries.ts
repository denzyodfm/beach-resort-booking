import "server-only";

import type { PoolConnection } from "mysql2/promise";

import { getPool, parseJsonArray, query, type DbRow } from "@/lib/db";
import { computePaymentDeadline } from "@/lib/reservation-expiry";

/**
 * Booking rows with the joined room nested under `rooms`, the same shape the
 * dashboards and booking screens read: `{ ...booking, rooms: { name, booking_includes } }`.
 */
export async function fetchBookingRows(where = "", params: unknown[] = [], db: PoolConnection | ReturnType<typeof getPool> = getPool()) {
  const rows = await query(
    `select b.*, r.name as joined_room_name, r.booking_includes as joined_room_booking_includes
       from bookings b
       left join rooms r on r.id = b.room_id
       ${where}
      order by b.created_at desc`,
    params,
    db,
  );

  return rows.map(({ joined_room_name, joined_room_booking_includes, ...booking }): DbRow => ({
    ...booking,
    payment_deadline: booking.payment_deadline || computePaymentDeadline(booking.created_at, joined_room_booking_includes),
    rooms:
      joined_room_name == null
        ? null
        : { name: String(joined_room_name), booking_includes: parseJsonArray(joined_room_booking_includes) },
  }));
}

export async function fetchBookingRow(id: string, db?: PoolConnection) {
  const rows = await fetchBookingRows("where b.id = ?", [id], db);
  return rows[0] ?? null;
}

/** Review rows with `rooms: { name }`, the shape normalizeReview reads. */
export async function fetchReviewRows(where = "", params: unknown[] = []) {
  const rows = await query(
    `select v.*, r.name as joined_room_name
       from reviews v
       left join rooms r on r.id = v.room_id
       ${where}
      order by v.created_at desc`,
    params,
  );

  return rows.map(({ joined_room_name, ...review }): DbRow => ({
    ...review,
    rooms: joined_room_name == null ? undefined : { name: String(joined_room_name) },
  }));
}

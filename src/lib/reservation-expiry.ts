import "server-only";

import { execute, hasDatabaseEnv, parseJsonArray, query } from "@/lib/db";
import { getReservationHoldHours } from "@/lib/resort-data";

/** Deadline for a booking that predates the payment_deadline column: created_at + the cottage's hold. */
export function computePaymentDeadline(createdAt: unknown, bookingIncludes: unknown) {
  const holdHours = getReservationHoldHours(parseJsonArray(bookingIncludes));
  return new Date(new Date(String(createdAt)).getTime() + holdHours * 60 * 60 * 1000).toISOString();
}

/**
 * Cancels pending bookings that are still unpaid after their payment deadline.
 * Bookings where the guest has submitted a payment reference ('authorized') are
 * left alone until staff verify or reject the reference.
 */
export async function expireUnpaidReservations() {
  if (!hasDatabaseEnv()) return 0;

  try {
    const data = await query(
      `select b.id, b.created_at, b.payment_deadline, r.booking_includes
         from bookings b
         left join rooms r on r.id = b.room_id
        where b.status = 'pending' and b.payment_status = 'unpaid'`,
    );

    if (!data.length) return 0;

    const now = Date.now();
    const expiredIds = data.flatMap((booking) => {
      const deadline = booking.payment_deadline
        ? String(booking.payment_deadline)
        : computePaymentDeadline(booking.created_at, booking.booking_includes);
      const expiresAt = new Date(deadline).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= now ? [booking.id] : [];
    });

    if (!expiredIds.length) return 0;

    const result = await execute(
      `update bookings set status = 'cancelled', cancelled_at = utc_timestamp(3)
        where id in (?) and status = 'pending' and payment_status = 'unpaid'`,
      [expiredIds],
    );

    return result.affectedRows;
  } catch {
    return 0;
  }
}

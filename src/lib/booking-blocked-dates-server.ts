import "server-only";

import { normalizeBlockedDate, type BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { getServerBlockedDates } from "@/lib/booking-blocked-dates-store";
import { hasDatabaseEnv, query } from "@/lib/db";

export async function getBookingBlockedDates(): Promise<BookingBlockedDate[]> {
  if (!hasDatabaseEnv()) {
    return getServerBlockedDates();
  }

  try {
    return (await query("select * from booking_blackout_dates order by blocked_date")).map(normalizeBlockedDate);
  } catch {
    return [];
  }
}

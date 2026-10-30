import "server-only";

import { hasDatabaseEnv, queryOne } from "@/lib/db";
import { defaultBookingSettings, normalizeBookingSettings, type BookingSettings } from "@/lib/booking-settings";

export async function getBookingSettings(): Promise<BookingSettings> {
  if (!hasDatabaseEnv()) return defaultBookingSettings;

  try {
    const row = await queryOne(
      `select reservation_fee_amount, premium_fee_amount, internet_fee_amount, entrance_fee_amount,
              entrance_fee_child_amount, entrance_fee_senior_amount, entrance_fee_note, payment_instructions
         from resort_settings where id = 1`,
    );
    return normalizeBookingSettings(row);
  } catch {
    // Columns missing until scripts/migrate-online-booking.mjs has run.
    return defaultBookingSettings;
  }
}

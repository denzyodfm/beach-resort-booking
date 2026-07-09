import "server-only";

import { normalizeBlockedDate, type BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { getServerBlockedDates } from "@/lib/booking-blocked-dates-store";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";

export async function getBookingBlockedDates(): Promise<BookingBlockedDate[]> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getServerBlockedDates();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("booking_blackout_dates").select("*").order("blocked_date");

  if (error) return [];
  return (data || []).map(normalizeBlockedDate);
}

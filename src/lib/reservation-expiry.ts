import "server-only";

import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { getReservationHoldHours } from "@/lib/resort-data";

export async function expireUnpaidReservations() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, created_at, rooms(booking_includes)")
    .eq("status", "pending")
    .eq("payment_status", "unpaid");

  if (error || !data?.length) return 0;

  const now = Date.now();
  const expiredIds = data.flatMap((booking) => {
    const relation = booking.rooms as unknown as { booking_includes?: unknown } | Array<{ booking_includes?: unknown }> | null;
    const room = Array.isArray(relation) ? relation[0] : relation;
    const holdHours = getReservationHoldHours(room?.booking_includes);
    const expiresAt = new Date(booking.created_at).getTime() + holdHours * 60 * 60 * 1000;
    return Number.isFinite(expiresAt) && expiresAt <= now ? [booking.id] : [];
  });

  if (!expiredIds.length) return 0;

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("id", expiredIds)
    .eq("status", "pending")
    .eq("payment_status", "unpaid");

  return updateError ? 0 : expiredIds.length;
}

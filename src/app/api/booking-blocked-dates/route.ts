import { normalizeBlockedDate } from "@/lib/booking-blocked-dates";
import { getServerBlockedDates } from "@/lib/booking-blocked-dates-store";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(getServerBlockedDates());
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("booking_blackout_dates").select("*").order("blocked_date");

  if (error) {
    return Response.json([]);
  }

  return Response.json((data || []).map(normalizeBlockedDate));
}

import { normalizeBlockedDate } from "@/lib/booking-blocked-dates";
import {
  addServerBlockedDate,
  deleteServerBlockedDate,
  getServerBlockedDates,
} from "@/lib/booking-blocked-dates-store";
import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(getServerBlockedDates());
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("booking_blackout_dates").select("*").order("blocked_date");

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json((data || []).map(normalizeBlockedDate));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const date = String(body.date || body.blocked_date || "").trim();
  const label = String(body.label || body.name || "Philippine holiday").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ message: "Select a valid holiday date." }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      addServerBlockedDate({
        id: date,
        date,
        label,
        createdAt: new Date().toISOString(),
      }),
      { status: 201 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("booking_blackout_dates")
    .upsert({ blocked_date: date, label }, { onConflict: "blocked_date" })
    .select()
    .single();

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json(normalizeBlockedDate(data), { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return Response.json({ message: "Missing holiday id." }, { status: 400 });

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const deleted = deleteServerBlockedDate(id);
    if (!deleted) return Response.json({ message: "Holiday date not found." }, { status: 404 });
    return Response.json(deleted);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("booking_blackout_dates").delete().eq("id", id);

  if (error) return Response.json({ message: getSetupMessage(error.message) }, { status: 500 });
  return Response.json({ id });
}

function getSetupMessage(message: string) {
  if (message.includes("booking_blackout_dates")) {
    return "Holiday table is not ready. Run the Supabase schema update for booking_blackout_dates.";
  }

  return message;
}

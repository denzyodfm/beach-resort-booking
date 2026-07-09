import { NextRequest } from "next/server";
import { hasSupabaseEnv, createAdminClient } from "@/lib/supabase-server";
import { getServerDemoBookings } from "@/lib/demo-booking-store";
import { getRoomById, nightsBetween } from "@/lib/resort-data";
import { findBookingConflict, getUnavailableRanges } from "@/lib/booking-logic";
import { findBlockedBookingDate } from "@/lib/booking-blocked-dates";
import { getBookingBlockedDates } from "@/lib/booking-blocked-dates-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const room = getRoomById(roomId);

  if (!room || !checkIn || !checkOut || nightsBetween(checkIn, checkOut) < 1) {
    return Response.json({ available: false, message: "Choose a cottage and valid dates." }, { status: 400 });
  }

  const blockedDate = findBlockedBookingDate(checkIn, checkOut, await getBookingBlockedDates());
  if (blockedDate.blocked) {
    return Response.json({
      available: false,
      unavailableRanges: [],
      message: blockedDate.reason,
    });
  }

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const demoBookings = getServerDemoBookings();
    const conflict = findBookingConflict(demoBookings, roomId, checkIn, checkOut);
    const unavailableRanges = getUnavailableRanges(demoBookings, roomId);

    return Response.json({
      available: !conflict,
      unavailableRanges,
      message: conflict
        ? `Unavailable: ${room.name} is already held from ${conflict.checkIn} to ${conflict.checkOut}.`
        : `${room.name} is available for ${nightsBetween(checkIn, checkOut)} day${nightsBetween(checkIn, checkOut) === 1 ? "" : "s"}.`,
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .eq("room_id", roomId)
    .in("status", ["pending", "confirmed", "checked_in"])
    .lte("check_in", checkOut)
    .gte("check_out", checkIn)
    .limit(1);

  if (error) {
    return Response.json({ available: false, message: error.message }, { status: 500 });
  }

  const { data: unavailableRows, error: unavailableError } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .eq("room_id", roomId)
    .in("status", ["pending", "confirmed", "checked_in"])
    .order("check_in", { ascending: true });

  if (unavailableError) {
    return Response.json({ available: false, message: unavailableError.message }, { status: 500 });
  }

  const available = data.length === 0;
  return Response.json({
    available,
    unavailableRanges: unavailableRows.map((booking) => ({
      bookingId: booking.id,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      label: `${booking.check_in} to ${booking.check_out}`,
    })),
    message: available ? "This stay is available for your dates." : "Those dates are already booked.",
  });
}

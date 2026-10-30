import { NextRequest } from "next/server";
import { errorMessage, hasDatabaseEnv, query } from "@/lib/db";
import { getServerDemoBookings } from "@/lib/demo-booking-store";
import { getRoomById, nightsBetween } from "@/lib/resort-data";
import { findBookingConflict, getUnavailableRanges } from "@/lib/booking-logic";
import { findBlockedBookingDate } from "@/lib/booking-blocked-dates";
import { getBookingBlockedDates } from "@/lib/booking-blocked-dates-server";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";
import { getBookingChannel } from "@/lib/booking-settings";
import { getRoomCatalog } from "@/lib/rooms-server";

export async function GET(request: NextRequest) {
  await expireUnpaidReservations();
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";

  if (categoryId) return categoryAvailability(categoryId, checkIn, checkOut);

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

  if (!hasDatabaseEnv()) {
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

  try {
    const unavailableRows = await query(
      `select id, check_in, check_out from bookings
        where room_id = ? and status in ('pending', 'confirmed', 'checked_in')
        order by check_in asc`,
      [roomId],
    );

    // Stays are inclusive of both dates, so ranges overlap when each starts on or before the other ends.
    const available = !unavailableRows.some(
      (booking) => String(booking.check_in) <= checkOut && String(booking.check_out) >= checkIn,
    );

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
  } catch (error) {
    return Response.json({ available: false, message: errorMessage(error) }, { status: 500 });
  }
}

/** Standard bookings: how many online cottages in the category are free for the whole stay. */
async function categoryAvailability(categoryId: string, checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) < 1) {
    return Response.json({ available: false, availableCount: 0, message: "Choose valid dates." }, { status: 400 });
  }

  const blockedDate = findBlockedBookingDate(checkIn, checkOut, await getBookingBlockedDates());
  if (blockedDate.blocked) {
    return Response.json({ available: false, availableCount: 0, message: blockedDate.reason });
  }

  const { rooms } = await getRoomCatalog();
  const onlineRooms = rooms.filter(
    (room) => room.categoryId === categoryId && room.available !== false && getBookingChannel(room) === "online",
  );

  try {
    const bookings = hasDatabaseEnv()
      ? await query(
          `select room_id from bookings
            where status in ('pending', 'confirmed', 'checked_in') and check_in <= ? and check_out >= ?`,
          [checkOut, checkIn],
        )
      : getServerDemoBookings()
          .filter((booking) => booking.status !== "cancelled" && booking.checkIn <= checkOut && booking.checkOut >= checkIn)
          .map((booking) => ({ room_id: booking.roomId }));
    const taken = new Set(bookings.map((booking) => String(booking.room_id)));
    const availableCount = onlineRooms.filter((room) => !taken.has(room.id)).length;

    return Response.json({
      available: availableCount > 0,
      availableCount,
      message: availableCount
        ? `${availableCount} cottage${availableCount === 1 ? "" : "s"} available. We will assign one when you book.`
        : "Every cottage in this category is booked for those dates.",
    });
  } catch (error) {
    return Response.json({ available: false, availableCount: 0, message: errorMessage(error) }, { status: 500 });
  }
}

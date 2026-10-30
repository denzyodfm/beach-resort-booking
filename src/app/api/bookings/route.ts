import { randomUUID } from "node:crypto";

import { errorMessage, execute, hasDatabaseEnv, query, queryOne, toDbValue, transaction } from "@/lib/db";
import { fetchBookingRow, fetchBookingRows } from "@/lib/record-queries";
import {
  getServerDemoBookings,
  updateServerDemoBooking,
} from "@/lib/demo-booking-store";
import { getRoomById, nightsBetween } from "@/lib/resort-data";
import { getRoomCatalog } from "@/lib/rooms-server";
import {
  buildBookingConfirmationMessage,
  canGuestCancel,
} from "@/lib/booking-logic";
import {
  formatDeadline,
  getBookingChannel,
  getBookingCharges,
  normalizeParty,
  partySize,
  type BookingCharges,
  type BookingType,
} from "@/lib/booking-settings";
import { getBookingSettings } from "@/lib/booking-settings-server";
import type { Room } from "@/lib/types";
import { findBlockedBookingDate } from "@/lib/booking-blocked-dates";
import { getBookingBlockedDates } from "@/lib/booking-blocked-dates-server";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationSms } from "@/lib/sms";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";
import { getSessionUser, isResortManager } from "@/lib/admin-auth";

/**
 * Availability-only view of a booking. The public date grid needs to know which
 * cottage is taken on which day; it does not need the guest's name, contact
 * details, or what they paid. Those fields only go out to staff and admin.
 */
function toAvailabilityRow(row: Record<string, unknown>) {
  const room = row.rooms as { name?: string } | undefined;

  return {
    id: String(row.id ?? row.booking_number ?? ""),
    roomId: String(row.roomId ?? row.room_id ?? ""),
    roomName: String(row.roomName ?? room?.name ?? "Cottage"),
    checkIn: String(row.checkIn ?? row.check_in ?? ""),
    checkOut: String(row.checkOut ?? row.check_out ?? ""),
    status: String(row.status ?? "pending"),
    paymentStatus: String(row.paymentStatus ?? row.payment_status ?? "unpaid"),
  };
}

export async function GET() {
  await expireUnpaidReservations();
  const manager = await isResortManager();

  if (!hasDatabaseEnv()) {
    const demoBookings = getServerDemoBookings();
    return Response.json(
      manager ? demoBookings : demoBookings.map((booking) => toAvailabilityRow(booking as unknown as Record<string, unknown>)),
    );
  }

  try {
    const data = await fetchBookingRows();
    return Response.json(manager ? data : data.map((row) => toAvailabilityRow(row)));
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await expireUnpaidReservations();
  const body = (await request.json()) as {
    /** The chosen cottage (premium and walk-in bookings). */
    roomId?: string;
    /** The category to assign a cottage from (standard bookings). */
    categoryId?: string;
    bookingType?: BookingType;
    internetAccess?: boolean;
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    /** Regular / children / senior-PWD counts for the entrance fee; their sum is the guest count. */
    party?: { regular?: number; child?: number; senior?: number };
    totalPrice: number;
  };
  const party = normalizeParty(body.party, body.guests);
  const guests = partySize(party);

  const manager = await isResortManager();
  const [catalog, settings] = await Promise.all([getRoomCatalog(), getBookingSettings()]);
  const bookingType: BookingType = body.bookingType === "standard" ? "standard" : "premium";
  const internetAccess = Boolean(body.internetAccess) && settings.internetFeeAmount > 0;
  const days = body.checkIn && body.checkOut ? nightsBetween(body.checkIn, body.checkOut) : 0;

  if (!body.guestPhone?.trim()) {
    return Response.json({ message: "Cellphone number is required for booking confirmation." }, { status: 400 });
  }

  if (days < 1 || !(guests >= 1)) {
    return Response.json({ message: "Review cottage, dates, and guest count." }, { status: 400 });
  }

  // Standard bookings may land on any free online cottage in the category whose
  // price matches what the guest was quoted. Premium and walk-in bookings name
  // their cottage.
  let candidates: Room[];
  if (bookingType === "standard") {
    candidates = catalog.rooms.filter(
      (room) =>
        room.categoryId === body.categoryId &&
        room.available !== false &&
        getBookingChannel(room) === "online" &&
        guests <= room.maxGuests &&
        getBookingCharges({ room, days, settings, bookingType, internetAccess, party }).total === body.totalPrice,
    );
    if (!candidates.length) {
      return Response.json(
        { message: "No cottage in this category matches that price and guest count. Refresh the page and try again." },
        { status: 400 },
      );
    }
  } else {
    const room =
      catalog.rooms.find((item) => item.id === body.roomId) || (hasDatabaseEnv() ? undefined : getRoomById(body.roomId || ""));
    if (!room || room.available === false) {
      return Response.json({ message: "That cottage is not available for booking." }, { status: 404 });
    }
    if (getBookingChannel(room) === "walk_in" && !manager) {
      return Response.json(
        { message: `${room.name} is reserved for walk-in guests and cannot be booked online. Please choose an online cottage.` },
        { status: 403 },
      );
    }
    if (guests > room.maxGuests) {
      return Response.json({ message: `${room.name} takes at most ${room.maxGuests} guests.` }, { status: 400 });
    }
    if (getBookingCharges({ room, days, settings, bookingType, internetAccess, party }).total !== body.totalPrice) {
      return Response.json(
        { message: "The submitted total does not match the current rates and fees. Refresh the page and try again." },
        { status: 400 },
      );
    }
    candidates = [room];
  }

  const blockedDate = findBlockedBookingDate(body.checkIn, body.checkOut, await getBookingBlockedDates());
  if (blockedDate.blocked) {
    return Response.json({ message: blockedDate.reason }, { status: 409 });
  }

  if (!hasDatabaseEnv()) {
    return Response.json({
      message: "The database is not configured on this server, so bookings cannot be saved.",
    }, { status: 503 });
  }

  const sessionUser = await getSessionUser();
  let saved: { row: Record<string, unknown>; room: Room; charges: BookingCharges } | null;
  try {
    // MySQL has no exclusion constraint for overlapping stays, so lock the
    // cottage row first: concurrent bookings for the same cottage queue here
    // and each one sees the others' inserts before checking for a conflict.
    saved = await transaction(async (connection) => {
      for (const room of shuffle(candidates)) {
        const lockedRoom = await queryOne("select id from rooms where id = ? for update", [room.id], connection);
        if (!lockedRoom) continue;

        const conflicts = await query(
          `select id from bookings
            where room_id = ? and status in ('pending', 'confirmed', 'checked_in')
              and check_in <= ? and check_out >= ?
            limit 1`,
          [room.id, body.checkOut, body.checkIn],
          connection,
        );
        if (conflicts.length > 0) continue;

        const channel = getBookingChannel(room);
        const charges = getBookingCharges({ room, days, settings, bookingType, internetAccess, party });
        const paymentDeadline = new Date(Date.now() + (room.reservationHoldHours || 24) * 60 * 60 * 1000).toISOString();
        const id = randomUUID();
        await execute(
          `insert into bookings (id, booking_number, user_id, room_id, guest_name, guest_email, guest_phone, check_in, check_out,
             guest_count, nightly_rate, subtotal_amount, total_amount, status, payment_status, payment_deadline, special_requests)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?)`,
          [
            id,
            createBookingNumber(),
            sessionUser?.role === "guest" ? sessionUser.id : null,
            room.id,
            body.guestName,
            body.guestEmail || null,
            body.guestPhone,
            body.checkIn,
            body.checkOut,
            guests,
            room.pricePerNight,
            charges.cottageFee,
            charges.total,
            toDbValue(paymentDeadline),
            JSON.stringify({
              channel,
              bookingType: channel === "online" ? bookingType : undefined,
              internetAccess,
              party,
              charges,
            }),
          ],
          connection,
        );

        const row = await queryOne("select * from bookings where id = ?", [id], connection);
        return row ? { row, room, charges } : null;
      }

      throw new BookingError(
        bookingType === "standard"
          ? "Every cottage in this category is already booked for those dates. Try another date or category."
          : "Those dates are no longer available.",
        409,
      );
    });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }

  if (!saved) return Response.json({ message: "Unable to save booking." }, { status: 500 });

  const { row: data, room, charges } = saved;
  const bookingNumber = String(data.booking_number || data.id);
  const paymentDeadline = String(data.payment_deadline);
  const notification = {
    guestName: body.guestName,
    bookingId: bookingNumber,
    cottageName: room.name,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    totalAmount: charges.total,
    paymentDeadline,
  };
  const email = await sendBookingConfirmationEmail({ to: body.guestEmail, ...notification });
  const sms = await sendBookingConfirmationSms({ to: body.guestPhone, ...notification });

  return Response.json(
    {
      booking: data,
      bookingNumber,
      roomName: room.name,
      channel: getBookingChannel(room),
      bookingType,
      charges,
      paymentDeadline,
      paymentInstructions: settings.paymentInstructions,
      message: `${buildBookingConfirmationMessage({
        id: bookingNumber,
        roomName: room.name,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        guestPhone: body.guestPhone,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        totalPrice: charges.total,
      })} Pay before ${formatDeadline(paymentDeadline)}; otherwise this reservation will be cancelled automatically. ${email.sent ? `Confirmation email sent to ${body.guestEmail}.` : email.reason} ${
        sms.sent ? `Confirmation SMS sent to ${body.guestPhone}.` : sms.reason
      }`,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id: string;
    action: "cancel";
    guestEmail?: string;
    guestPhone?: string;
  };

  if (body.action !== "cancel") {
    return Response.json({ message: "Unsupported booking action." }, { status: 400 });
  }

  if (!hasDatabaseEnv()) {
    const booking = getServerDemoBookings().find((item) => item.id === body.id);
    if (!booking) return Response.json({ message: "Booking not found." }, { status: 404 });

    const cancellation = canGuestCancel(booking.checkIn);
    if (!cancellation.allowed) {
      return Response.json(
        { message: `Cancellation window closed. Free cancellation ended on ${cancellation.cancelBy}.` },
        { status: 403 },
      );
    }

    updateServerDemoBooking(body.id, { status: "cancelled" });

    return Response.json({
      id: booking.id,
      status: "cancelled",
      message: `Booking ${booking.id} was cancelled. Contact ${booking.guestPhone || booking.guestEmail} to confirm cancellation.`,
    });
  }

  const booking = await queryOne("select id, booking_number, guest_email, guest_phone, check_in, status from bookings where id = ?", [body.id]);
  if (!booking) return Response.json({ message: "Booking not found." }, { status: 404 });

  // These checks used to be skipped entirely when the caller sent no identifier,
  // so knowing a booking id was enough to cancel someone else's stay. Managers
  // may act on any booking; everyone else must prove they hold the contact
  // details the booking was made with.
  if (!(await isResortManager())) {
    const guestEmail = body.guestEmail?.trim();
    const guestPhone = body.guestPhone?.trim();

    if (!guestEmail && !guestPhone) {
      return Response.json(
        { message: "Provide the email or cellphone used for this booking." },
        { status: 403 },
      );
    }
    if (guestEmail && booking.guest_email !== guestEmail) {
      return Response.json({ message: "This booking does not match the guest email provided." }, { status: 403 });
    }
    if (guestPhone && booking.guest_phone !== guestPhone) {
      return Response.json({ message: "This booking does not match the guest cellphone provided." }, { status: 403 });
    }
  }

  const cancellation = canGuestCancel(String(booking.check_in));
  if (!cancellation.allowed) {
    return Response.json(
      { message: `Cancellation window closed. Free cancellation ended on ${cancellation.cancelBy}.` },
      { status: 403 },
    );
  }

  const result = await execute(
    `update bookings set status = 'cancelled', cancelled_at = utc_timestamp(3)
      where id = ? and status in ('draft', 'pending', 'confirmed')`,
    [body.id],
  );
  if (!result.affectedRows) {
    return Response.json({ message: "This booking can no longer be cancelled." }, { status: 409 });
  }

  const data = await fetchBookingRow(body.id);

  return Response.json({
    booking: data,
    message: `Booking ${booking.booking_number || body.id} was cancelled. Contact ${booking.guest_phone || booking.guest_email} to confirm cancellation.`,
  });
}

class BookingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function shuffle<T>(items: T[]) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function createBookingNumber() {
  return `BK-${randomUUID().slice(0, 8).toUpperCase()}`;
}

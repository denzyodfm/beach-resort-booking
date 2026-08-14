import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import {
  getServerDemoBookings,
  updateServerDemoBooking,
} from "@/lib/demo-booking-store";
import { getRoomById } from "@/lib/resort-data";
import { getRoomCatalog } from "@/lib/rooms-server";
import {
  buildBookingConfirmationMessage,
  calculateTotal,
  canGuestCancel,
} from "@/lib/booking-logic";
import { findBlockedBookingDate } from "@/lib/booking-blocked-dates";
import { getBookingBlockedDates } from "@/lib/booking-blocked-dates-server";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationSms } from "@/lib/sms";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";
import { isResortManager } from "@/lib/admin-auth";

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

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const demoBookings = getServerDemoBookings();
    return Response.json(
      manager ? demoBookings : demoBookings.map((booking) => toAvailabilityRow(booking as unknown as Record<string, unknown>)),
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, rooms(name, booking_includes)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ message: error.message }, { status: 500 });

  return Response.json(
    manager ? data : (data || []).map((row) => toAvailabilityRow(row as Record<string, unknown>)),
  );
}

export async function POST(request: Request) {
  await expireUnpaidReservations();
  const body = (await request.json()) as {
    roomId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
  };

  const catalog = await getRoomCatalog();
  const room = catalog.rooms.find((item) => item.id === body.roomId) || getRoomById(body.roomId);
  const { nights, subtotal, total: cottageTotal } = room
    ? calculateTotal(room.pricePerNight, body.checkIn, body.checkOut)
    : { nights: 0, subtotal: 0, total: 0 };
  const premiumFee = room?.premiumFeeEnabled ? room.premiumFeeAmount || 0 : 0;
  const reservationFee = room?.reservationFeeEnabled ? room.reservationFeeAmount || 0 : 0;
  const total = cottageTotal + premiumFee + reservationFee;

  if (!room || nights < 1 || body.guests < 1 || body.guests > room.maxGuests) {
    return Response.json({ message: "Review cottage, dates, and guest count." }, { status: 400 });
  }

  if (!body.guestPhone?.trim()) {
    return Response.json({ message: "Cellphone number is required for booking confirmation." }, { status: 400 });
  }

  const blockedDate = findBlockedBookingDate(body.checkIn, body.checkOut, await getBookingBlockedDates());
  if (blockedDate.blocked) {
    return Response.json({ message: blockedDate.reason }, { status: 409 });
  }

  if (body.totalPrice !== total) {
    return Response.json({ message: "The submitted total does not match the daily rate and dates." }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({
      message: "Supabase is not configured on this server, so bookings cannot be saved.",
    }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: conflicts, error: conflictError } = await supabase
    .from("bookings")
    .select("id")
    .eq("room_id", body.roomId)
    .in("status", ["pending", "confirmed", "checked_in"])
    .lte("check_in", body.checkOut)
    .gte("check_out", body.checkIn)
    .limit(1);

  if (conflictError) return Response.json({ message: conflictError.message }, { status: 500 });
  if (conflicts.length > 0) return Response.json({ message: "Those dates are no longer available." }, { status: 409 });

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      room_id: body.roomId,
      guest_name: body.guestName,
      guest_email: body.guestEmail || null,
      guest_phone: body.guestPhone,
      check_in: body.checkIn,
      check_out: body.checkOut,
      guest_count: body.guests,
      nightly_rate: room.pricePerNight,
      subtotal_amount: subtotal,
      total_amount: total,
      status: "pending",
      payment_status: "unpaid",
    })
    .select()
    .single();

  if (error) return Response.json({ message: error.message }, { status: 500 });

  const email = await sendBookingConfirmationEmail({
    to: body.guestEmail,
    guestName: body.guestName,
    bookingId: data.booking_number || data.id,
    cottageName: room.name,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    totalAmount: total,
  });
  const sms = await sendBookingConfirmationSms({
    to: body.guestPhone,
    guestName: body.guestName,
    bookingId: data.booking_number || data.id,
    cottageName: room.name,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    totalAmount: total,
  });
  const holdHours = room.reservationHoldHours || 24;
  const holdExpiresAt = new Date(new Date(data.created_at).getTime() + holdHours * 60 * 60 * 1000).toISOString();

  return Response.json(
    {
      booking: data,
      holdExpiresAt,
      message: `${buildBookingConfirmationMessage({
        id: data.booking_number || data.id,
        roomName: room.name,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        guestPhone: body.guestPhone,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        totalPrice: total,
      })} Payment must be recorded within ${holdHours} hours (before ${holdExpiresAt}); otherwise this reservation will be cancelled automatically. ${email.sent ? `Confirmation email sent to ${body.guestEmail}.` : email.reason} ${
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

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

  const supabase = createAdminClient();
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select("id, guest_email, guest_phone, check_in, status")
    .eq("id", body.id)
    .single();

  if (lookupError) return Response.json({ message: lookupError.message }, { status: 404 });

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

  const cancellation = canGuestCancel(booking.check_in);
  if (!cancellation.allowed) {
    return Response.json(
      { message: `Cancellation window closed. Free cancellation ended on ${cancellation.cancelBy}.` },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", body.id)
    .in("status", ["draft", "pending", "confirmed"])
    .select()
    .single();

  if (error) return Response.json({ message: error.message }, { status: 500 });

  return Response.json({
    booking: data,
    message: `Booking ${body.id} was cancelled. Contact ${booking.guest_phone || booking.guest_email} to confirm cancellation.`,
  });
}

import { errorMessage, execute, hasDatabaseEnv, queryOne } from "@/lib/db";
import { readBookingExtras } from "@/lib/booking-row";
import {
  isValidPaymentReference,
  normalizePaymentReference,
  samePhoneNumber,
} from "@/lib/booking-settings";
import { getBookingSettings } from "@/lib/booking-settings-server";
import { fetchBookingRow } from "@/lib/record-queries";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";

/**
 * Guest payment page. A guest proves the booking is theirs with the booking
 * number and the cellphone number it was made with, then can see the payment
 * deadline and submit the reference number of their online payment. Submitting
 * a reference stops the automatic cancellation until staff verify it.
 */
export async function POST(request: Request) {
  if (!hasDatabaseEnv()) {
    return Response.json({ message: "Online payment needs the database to be connected." }, { status: 503 });
  }

  const body = (await request.json()) as {
    action?: "lookup" | "submit";
    bookingNumber?: string;
    guestPhone?: string;
    reference?: string;
  };
  const bookingNumber = String(body.bookingNumber || "").trim().toUpperCase();

  if (!bookingNumber || !body.guestPhone?.trim()) {
    return Response.json({ message: "Enter your booking number and the cellphone number you booked with." }, { status: 400 });
  }

  await expireUnpaidReservations();

  const match = await queryOne("select id, guest_phone from bookings where booking_number = ? or id = ?", [
    bookingNumber,
    bookingNumber.toLowerCase(),
  ]);
  if (!match || !samePhoneNumber(match.guest_phone, body.guestPhone)) {
    return Response.json(
      { message: "No booking matches that booking number and cellphone number. Check both and try again." },
      { status: 404 },
    );
  }

  const bookingId = String(match.id);

  if (body.action === "submit") {
    const reference = normalizePaymentReference(body.reference);
    if (!isValidPaymentReference(reference)) {
      return Response.json(
        { message: "Enter the reference number exactly as it appears on your GCash or bank receipt (6 to 40 letters or digits)." },
        { status: 400 },
      );
    }

    const current = await fetchBookingRow(bookingId);
    if (!current) return Response.json({ message: "Booking not found." }, { status: 404 });

    if (current.status === "cancelled") {
      return Response.json(
        { message: "This booking was cancelled because payment was not received before the deadline. Please make a new booking." },
        { status: 409 },
      );
    }
    if (current.payment_status !== "unpaid") {
      return Response.json(
        { message: "A payment reference was already received for this booking. The resort will verify it shortly." },
        { status: 409 },
      );
    }

    const usedElsewhere = await queryOne("select id from bookings where payment_reference = ? and id <> ? limit 1", [
      reference,
      bookingId,
    ]);
    if (usedElsewhere) {
      return Response.json(
        { message: "That reference number was already used for another booking. Check your receipt and try again." },
        { status: 409 },
      );
    }

    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(String(current.special_requests || "{}")) || {};
    } catch {
      details = { note: String(current.special_requests || "") };
    }

    try {
      // The status condition makes this a no-op if the booking expired or was
      // paid between the checks above and now.
      const result = await execute(
        `update bookings set payment_reference = ?, payment_status = 'authorized', special_requests = ?
          where id = ? and status = 'pending' and payment_status = 'unpaid'`,
        [reference, JSON.stringify({ ...details, referenceSubmittedAt: new Date().toISOString() }), bookingId],
      );
      if (!result.affectedRows) {
        return Response.json({ message: "This booking can no longer accept a payment reference." }, { status: 409 });
      }
    } catch (error) {
      return Response.json({ message: errorMessage(error) }, { status: 500 });
    }
  }

  const row = await fetchBookingRow(bookingId);
  if (!row) return Response.json({ message: "Booking not found." }, { status: 404 });

  return Response.json({
    booking: await toGuestView(row),
    message:
      body.action === "submit"
        ? "Reference number received. The resort will verify your payment and confirm your booking."
        : undefined,
  });
}

/** What the guest may see about their own booking. Never includes payment proof images or staff notes. */
async function toGuestView(row: Record<string, unknown>) {
  const extras = readBookingExtras(row);
  let amountPaid = 0;
  try {
    amountPaid = Number(JSON.parse(String(row.special_requests || "{}")).paymentAmountPaid) || 0;
  } catch {
    amountPaid = 0;
  }

  return {
    bookingNumber: String(row.booking_number || row.id),
    roomName: String((row.rooms as { name?: string } | null)?.name || "Cottage"),
    guestName: String(row.guest_name || ""),
    checkIn: String(row.check_in || ""),
    checkOut: String(row.check_out || ""),
    guests: Number(row.guest_count || 1),
    status: String(row.status || "pending"),
    paymentStatus: String(row.payment_status || "unpaid"),
    totalPrice: Number(row.total_amount || 0),
    amountPaid,
    paymentInstructions: (await getBookingSettings()).paymentInstructions,
    ...extras,
  };
}

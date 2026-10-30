import { getSessionUser, requireResortManager } from "@/lib/admin-auth";
import { errorMessage, execute, hasDatabaseEnv, queryOne, toSetClause } from "@/lib/db";
import { fetchBookingRow, fetchBookingRows } from "@/lib/record-queries";
import { getServerDemoBookings, updateServerDemoBooking } from "@/lib/demo-booking-store";
import { isPaidEnoughToConfirm } from "@/lib/booking-logic";
import type { Booking, BookingStatus, PaymentLog, PaymentStatus } from "@/lib/types";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";
import { readBookingExtras } from "@/lib/booking-row";
import { isValidPaymentReference, normalizePaymentReference } from "@/lib/booking-settings";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  await expireUnpaidReservations();
  if (!hasDatabaseEnv()) {
    return Response.json(getServerDemoBookings());
  }

  try {
    return Response.json(await fetchBookingRows());
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const {
    id,
    status,
    paymentStatus,
    paymentNote,
    paymentAmountPaid,
    paymentProofUrl,
    paymentProofName,
    paymentHistory,
    refundAmount,
    refundReason,
    paymentReference,
    rejectReference,
  } = await request.json();
  const hasPaymentDetails =
    typeof paymentNote === "string" ||
    typeof paymentAmountPaid === "number" ||
    typeof paymentProofUrl === "string" ||
    typeof paymentProofName === "string" ||
    Array.isArray(paymentHistory) ||
    typeof refundAmount === "number" ||
    typeof refundReason === "string";

  if (!hasDatabaseEnv()) {
    const booking = getServerDemoBookings().find((item) => item.id === id);
    if (!booking) return Response.json({ message: "Booking not found." }, { status: 404 });

    const effectivePaymentStatus = (paymentStatus || booking.paymentStatus) as PaymentStatus;
    if (status === "confirmed" && !isPaidEnoughToConfirm(effectivePaymentStatus)) {
      return Response.json({ message: "Payment must be verified before confirming this booking." }, { status: 409 });
    }

    const updates: Partial<Booking> = {};
    if (status) updates.status = status as BookingStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus as PaymentStatus;
    if (typeof paymentNote === "string") updates.paymentNote = paymentNote;
    if (typeof paymentAmountPaid === "number") updates.paymentAmountPaid = paymentAmountPaid;
    if (typeof paymentProofUrl === "string") updates.paymentProofUrl = paymentProofUrl;
    if (typeof paymentProofName === "string") updates.paymentProofName = paymentProofName;
    if (Array.isArray(paymentHistory)) updates.paymentHistory = normalizePaymentHistory(paymentHistory);
    if (typeof refundAmount === "number") updates.refundAmount = refundAmount;
    if (typeof refundReason === "string") updates.refundReason = refundReason;

    const updated = updateServerDemoBooking(id, updates);
    return Response.json(updated);
  }

  const updates: Record<string, unknown> = {};
  if (paymentStatus) updates.payment_status = paymentStatus;

  // The guest's reference did not match a real payment: put the booking back to
  // unpaid so its original payment deadline applies again.
  if (rejectReference === true) {
    try {
      const result = await execute(
        `update bookings set payment_status = 'unpaid', payment_reference = null
          where id = ? and payment_status = 'authorized'`,
        [id],
      );
      if (!result.affectedRows) {
        return Response.json({ message: "This booking has no unverified payment reference." }, { status: 409 });
      }
      await expireUnpaidReservations();
      return Response.json(await fetchBookingRow(id));
    } catch (error) {
      return Response.json({ message: errorMessage(error) }, { status: 500 });
    }
  }

  let existingSpecialRequests = "";
  if (status === "confirmed" || hasPaymentDetails || typeof paymentReference === "string") {
    const booking = await queryOne(
      "select payment_status, payment_reference, special_requests from bookings where id = ?",
      [id],
    );

    if (!booking) return Response.json({ message: "Booking not found." }, { status: 404 });
    existingSpecialRequests = String(booking.special_requests || "");

    const effectivePaymentStatus = (paymentStatus || booking.payment_status) as PaymentStatus;
    if (status === "confirmed" && !isPaidEnoughToConfirm(effectivePaymentStatus)) {
      return Response.json({ message: "Payment must be verified before confirming this booking." }, { status: 409 });
    }

    // Online bookings are paid online, so a payment is only accepted with the
    // reference number staff matched against the GCash or bank record.
    const reference = typeof paymentReference === "string"
      ? normalizePaymentReference(paymentReference)
      : String(booking.payment_reference || "");
    const markingPaid = paymentStatus === "paid" || paymentStatus === "deposit_paid";
    if (markingPaid && readBookingExtras(booking).channel === "online" && !reference) {
      return Response.json(
        { message: "Enter the payment reference number to verify an online booking's payment." },
        { status: 400 },
      );
    }
    if (typeof paymentReference === "string" && reference) {
      if (!isValidPaymentReference(reference)) {
        return Response.json({ message: "Reference numbers are 6 to 40 letters or digits." }, { status: 400 });
      }
      const usedElsewhere = await queryOne(
        "select booking_number from bookings where payment_reference = ? and id <> ? limit 1",
        [reference, id],
      );
      if (usedElsewhere) {
        return Response.json(
          { message: `Reference ${reference} is already recorded on booking ${usedElsewhere.booking_number}.` },
          { status: 409 },
        );
      }
      updates.payment_reference = reference;
    }
  }

  if (status) updates.status = status;
  if (hasPaymentDetails) {
    const existingDetails = parseSpecialRequests(existingSpecialRequests);
    const actor = await getActor();
    const nextHistory = mergePaymentHistory(
      normalizePaymentHistory(existingDetails.paymentHistory),
      normalizePaymentHistory(paymentHistory),
      actor,
    );
    updates.special_requests = JSON.stringify({
      ...existingDetails,
      paymentNote: typeof paymentNote === "string" ? paymentNote : existingDetails.paymentNote || "",
      paymentAmountPaid:
        typeof paymentAmountPaid === "number" ? paymentAmountPaid : existingDetails.paymentAmountPaid || 0,
      paymentProofUrl:
        typeof paymentProofUrl === "string" ? paymentProofUrl : existingDetails.paymentProofUrl || "",
      paymentProofName:
        typeof paymentProofName === "string" ? paymentProofName : existingDetails.paymentProofName || "",
      paymentHistory: nextHistory,
      refundAmount: typeof refundAmount === "number" ? refundAmount : existingDetails.refundAmount || 0,
      refundReason: typeof refundReason === "string" ? refundReason : existingDetails.refundReason || "",
    });
  }

  try {
    if (Object.keys(updates).length) {
      const set = toSetClause(updates);
      await execute(`update bookings set ${set.sql} where id = ?`, [...set.params, id]);
    }

    const data = await fetchBookingRow(id);
    if (!data) return Response.json({ message: "Booking not found." }, { status: 404 });
    return Response.json(data);
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

function parseSpecialRequests(value: string) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { note: value };
  }
}

async function getActor() {
  const user = await getSessionUser();
  if (!user) return { name: "Unknown user", role: "staff" };

  return {
    name: user.fullName || user.email || "Unknown user",
    role: user.role || "staff",
  };
}

function normalizePaymentHistory(value: unknown): PaymentLog[] {
  return Array.isArray(value)
    ? value
        .map((entry) => entry as Partial<PaymentLog>)
        .filter((entry) => entry.type === "payment" || entry.type === "refund")
        .map((entry, index) => ({
          id: String(entry.id || `payment-log-${index}`),
          type: entry.type as "payment" | "refund",
          amount: Number(entry.amount || 0),
          note: String(entry.note || ""),
          proofName: entry.proofName ? String(entry.proofName) : "",
          paidBy: entry.paidBy ? String(entry.paidBy) : "",
          actorName: String(entry.actorName || "Unknown user"),
          actorRole: String(entry.actorRole || "staff"),
          createdAt: String(entry.createdAt || new Date().toISOString()),
          balanceAfter: Number(entry.balanceAfter || 0),
        }))
    : [];
}

function mergePaymentHistory(existing: PaymentLog[], incoming: PaymentLog[], actor: { name: string; role: string }) {
  const knownIds = new Set(existing.map((entry) => entry.id));
  const additions = incoming
    .filter((entry) => !knownIds.has(entry.id))
    .map((entry) => ({
      ...entry,
      actorName: actor.name,
      actorRole: actor.role,
    }));

  return [...existing, ...additions];
}

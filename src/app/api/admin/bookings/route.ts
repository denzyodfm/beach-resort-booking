import { createAdminClient, hasSupabaseEnv } from "@/lib/supabase-server";
import { getServerDemoBookings, updateServerDemoBooking } from "@/lib/demo-booking-store";
import { isPaidEnoughToConfirm } from "@/lib/booking-logic";
import type { Booking, BookingStatus, PaymentStatus } from "@/lib/types";

export async function GET() {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(getServerDemoBookings());
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, rooms(name)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(data);
}

export async function PATCH(request: Request) {
  const {
    id,
    status,
    paymentStatus,
    paymentNote,
    paymentAmountPaid,
    paymentProofUrl,
    paymentProofName,
    refundAmount,
    refundReason,
  } = await request.json();
  const hasPaymentDetails =
    typeof paymentNote === "string" ||
    typeof paymentAmountPaid === "number" ||
    typeof paymentProofUrl === "string" ||
    typeof paymentProofName === "string" ||
    typeof refundAmount === "number" ||
    typeof refundReason === "string";

  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
    if (typeof refundAmount === "number") updates.refundAmount = refundAmount;
    if (typeof refundReason === "string") updates.refundReason = refundReason;

    const updated = updateServerDemoBooking(id, updates);
    return Response.json(updated);
  }

  const updates: Record<string, unknown> = {};
  if (paymentStatus) updates.payment_status = paymentStatus;

  const supabase = createAdminClient();
  let existingSpecialRequests = "";
  if (status === "confirmed" || hasPaymentDetails) {
    const { data: booking, error: lookupError } = await supabase
      .from("bookings")
      .select("payment_status, special_requests")
      .eq("id", id)
      .single();

    if (lookupError) return Response.json({ message: lookupError.message }, { status: 404 });
    existingSpecialRequests = booking.special_requests || "";

    const effectivePaymentStatus = (paymentStatus || booking.payment_status) as PaymentStatus;
    if (status === "confirmed" && !isPaidEnoughToConfirm(effectivePaymentStatus)) {
      return Response.json({ message: "Payment must be verified before confirming this booking." }, { status: 409 });
    }
  }

  if (status) updates.status = status;
  if (hasPaymentDetails) {
    const existingDetails = parseSpecialRequests(existingSpecialRequests);
    updates.special_requests = JSON.stringify({
      ...existingDetails,
      paymentNote: typeof paymentNote === "string" ? paymentNote : existingDetails.paymentNote || "",
      paymentAmountPaid:
        typeof paymentAmountPaid === "number" ? paymentAmountPaid : existingDetails.paymentAmountPaid || 0,
      paymentProofUrl:
        typeof paymentProofUrl === "string" ? paymentProofUrl : existingDetails.paymentProofUrl || "",
      paymentProofName:
        typeof paymentProofName === "string" ? paymentProofName : existingDetails.paymentProofName || "",
      refundAmount: typeof refundAmount === "number" ? refundAmount : existingDetails.refundAmount || 0,
      refundReason: typeof refundReason === "string" ? refundReason : existingDetails.refundReason || "",
    });
  }

  const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(data);
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

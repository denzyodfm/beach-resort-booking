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
  const { id, status, paymentStatus } = await request.json();

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

    const updated = updateServerDemoBooking(id, updates);
    return Response.json(updated);
  }

  const updates: Record<string, string> = {};
  if (paymentStatus) updates.payment_status = paymentStatus;

  const supabase = createAdminClient();
  if (status === "confirmed") {
    const { data: booking, error: lookupError } = await supabase
      .from("bookings")
      .select("payment_status")
      .eq("id", id)
      .single();

    if (lookupError) return Response.json({ message: lookupError.message }, { status: 404 });

    const effectivePaymentStatus = (paymentStatus || booking.payment_status) as PaymentStatus;
    if (!isPaidEnoughToConfirm(effectivePaymentStatus)) {
      return Response.json({ message: "Payment must be verified before confirming this booking." }, { status: 409 });
    }
  }

  if (status) updates.status = status;

  const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();

  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json(data);
}

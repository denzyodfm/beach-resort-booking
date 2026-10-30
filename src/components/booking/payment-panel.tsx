"use client";

import { useEffect, useState } from "react";
import { AlarmClock, CheckCircle2, Clock, Loader2, Send, XCircle } from "lucide-react";
import { formatDeadline, formatPeso, formatTimeLeft } from "@/lib/booking-settings";

/** The guest's view of their booking, as returned by /api/bookings/payment. */
export type GuestBookingView = {
  bookingNumber: string;
  roomName: string;
  guestName?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  amountPaid?: number;
  paymentInstructions: string;
  paymentDeadline?: string;
  paymentReference?: string;
  bookingType?: "standard" | "premium";
  channel?: "online" | "walk_in";
  cottageSubtotal?: number;
  reservationFeeAmount?: number;
  premiumFeeAmount?: number;
  internetFeeAmount?: number;
  entranceFeeAmount?: number;
};

/** Re-renders every 30 seconds so countdowns stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Large, high-contrast payment deadline. Turns red in the last 3 hours. */
export function PaymentDeadlineBanner({ deadline, compact = false }: { deadline?: string; compact?: boolean }) {
  const now = useNow();
  if (!deadline) return null;

  const remaining = new Date(deadline).getTime() - now;
  const passed = remaining <= 0;
  const urgent = remaining < 3 * 60 * 60 * 1000;
  const tone = passed || urgent ? "border-rose-600 bg-rose-600" : "border-amber-500 bg-amber-500";

  return (
    <div role="alert" className={`rounded-xl border-2 ${tone} text-white shadow-lg ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/90">
        <AlarmClock aria-hidden="true" className="h-4 w-4 shrink-0" />
        Payment deadline
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`${compact ? "text-lg" : "text-2xl sm:text-3xl"} font-black leading-tight`}>
          {passed ? "Deadline passed" : `Pay before ${formatDeadline(deadline)}`}
        </p>
        {!passed ? (
          <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-950">{formatTimeLeft(deadline, now)}</p>
        ) : null}
      </div>
      <p className={`mt-2 ${compact ? "text-xs" : "text-sm"} font-semibold text-white/95`}>
        Unpaid reservations are cancelled automatically after the deadline and the cottage is released to other guests.
      </p>
    </div>
  );
}

/**
 * Everything a guest needs to pay: deadline, amount, where to pay and the
 * reference number form. Shown right after booking and on the Pay page.
 */
export function BookingPaymentPanel({
  booking,
  guestPhone,
  onUpdated,
}: {
  booking: GuestBookingView;
  guestPhone: string;
  onUpdated?: (booking: GuestBookingView) => void;
}) {
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const amountDue = Math.max(0, booking.totalPrice - (booking.amountPaid || 0));
  const awaitingPayment = booking.status === "pending" && booking.paymentStatus === "unpaid";
  const cancelled = booking.status === "cancelled";
  const referenceSubmitted = booking.paymentStatus === "authorized";
  const paid = booking.paymentStatus === "paid" || booking.paymentStatus === "deposit_paid";

  async function submitReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/bookings/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", bookingNumber: booking.bookingNumber, guestPhone, reference }),
      });
      const result = (await response.json()) as { booking?: GuestBookingView; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.message || "Unable to submit the reference number.");
      setNotice(result.message || "Reference number received.");
      setReference("");
      onUpdated?.(result.booking);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the reference number.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Booking number — keep this</p>
        <p className="mt-1 text-3xl font-black tracking-wide text-slate-950">{booking.bookingNumber}</p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-bold">{booking.roomName}</span>
          {booking.bookingType === "standard" ? " (assigned by the resort)" : booking.bookingType === "premium" ? " (your chosen cottage)" : ""}
          {" · "}
          {booking.checkIn}
          {booking.checkOut !== booking.checkIn ? ` to ${booking.checkOut}` : ""}
          {booking.guests ? ` · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {cancelled ? (
        <div role="alert" className="rounded-xl border-2 border-rose-600 bg-rose-50 p-4 text-rose-900">
          <p className="flex items-center gap-2 text-lg font-black">
            <XCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
            This reservation was cancelled
          </p>
          <p className="mt-1 text-sm">
            Payment was not received before the deadline, so the cottage was released. Please make a new booking.
          </p>
        </div>
      ) : null}

      {awaitingPayment ? <PaymentDeadlineBanner deadline={booking.paymentDeadline} /> : null}

      {referenceSubmitted && !cancelled ? (
        <div className="rounded-xl border-2 border-cyan-600 bg-cyan-50 p-4 text-cyan-950">
          <p className="flex items-center gap-2 text-lg font-black">
            <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
            Payment reference received
          </p>
          <p className="mt-1 text-sm">
            Reference no. <span className="font-mono font-bold">{booking.paymentReference}</span> is waiting for the resort to
            verify it against their records. Your booking will not be cancelled while it is being checked.
          </p>
        </div>
      ) : null}

      {paid && !cancelled ? (
        <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 text-emerald-950">
          <p className="flex items-center gap-2 text-lg font-black">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
            {booking.paymentStatus === "paid" ? "Payment verified" : "Deposit verified"}
          </p>
          <p className="mt-1 text-sm">
            {booking.status === "checked_in"
              ? "You are checked in. Enjoy your stay at Bolihon Cove!"
              : booking.status === "confirmed"
                ? "Your booking is confirmed. At the front desk, give your booking number and show this screen or your receipt."
                : "The resort will confirm your booking shortly."}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <ChargeLine label="Cottage fee" value={booking.cottageSubtotal ?? booking.totalPrice} />
        <ChargeLine label="Reservation fee" value={booking.reservationFeeAmount} />
        <ChargeLine label="Premium booking (chosen cottage)" value={booking.premiumFeeAmount} />
        <ChargeLine label="Entrance fee" value={booking.entranceFeeAmount} />
        <ChargeLine label="Internet access" value={booking.internetFeeAmount} />
        <div className="mt-3 flex items-end justify-between gap-4 border-t border-slate-200 pt-3">
          <span className="font-bold text-slate-700">{booking.amountPaid ? "Balance to pay" : "Amount to pay"}</span>
          <span className="text-2xl font-black text-slate-950">{formatPeso(amountDue)}</span>
        </div>
      </div>

      {awaitingPayment ? (
        <div className="grid gap-4 rounded-xl border-2 border-bolihon-green bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-bolihon-green">Step 1 · Pay online</p>
            {booking.paymentInstructions ? (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-base font-semibold text-slate-900">
                {booking.paymentInstructions}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                Send {formatPeso(amountDue)} by GCash or bank transfer. Use <strong>Chat with us</strong> to get the resort&apos;s
                payment account.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">Online bookings are paid online only — cash is for walk-in guests.</p>
          </div>
          <form onSubmit={submitReference} className="grid gap-2">
            <label htmlFor={`payment-reference-${booking.bookingNumber}`} className="text-xs font-black uppercase tracking-[0.18em] text-bolihon-green">
              Step 2 · Enter your payment reference no.
            </label>
            <p className="text-sm text-slate-600">
              Copy the reference number from your GCash or bank receipt. The resort uses it to verify your payment.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={`payment-reference-${booking.bookingNumber}`}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                required
                minLength={6}
                maxLength={60}
                autoComplete="off"
                placeholder="e.g. 1012 345 678901"
                className="min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 py-3 font-mono text-lg text-slate-950 outline-none focus:border-bolihon-green"
              />
              <button
                type="submit"
                disabled={submitting || reference.replace(/\s/g, "").length < 6}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-bolihon-green px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin" /> : <Send aria-hidden="true" className="h-5 w-5 shrink-0" />}
                {submitting ? "Submitting..." : "Submit reference"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {notice ? <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}

function ChargeLine({ label, value }: { label: string; value: number | undefined }) {
  if (!value) return null;
  return (
    <div className="mt-1 flex justify-between gap-4 text-slate-700 first:mt-0">
      <span>{label}</span>
      <span className="font-semibold">{formatPeso(value)}</span>
    </div>
  );
}

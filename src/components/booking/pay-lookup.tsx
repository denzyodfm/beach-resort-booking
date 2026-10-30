"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { BookingPaymentPanel, type GuestBookingView } from "./payment-panel";

export function PayLookup({ initialBookingNumber = "" }: { initialBookingNumber?: string }) {
  const [bookingNumber, setBookingNumber] = useState(initialBookingNumber);
  const [guestPhone, setGuestPhone] = useState("");
  const [booking, setBooking] = useState<GuestBookingView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", bookingNumber, guestPhone }),
      });
      const result = (await response.json()) as { booking?: GuestBookingView; message?: string };
      if (!response.ok || !result.booking) throw new Error(result.message || "Booking not found.");
      setBooking(result.booking);
    } catch (lookupError) {
      setBooking(null);
      setError(lookupError instanceof Error ? lookupError.message : "Booking not found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={lookup} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="pay-booking-number" className="text-sm font-semibold text-slate-700">Booking number</label>
          <input
            id="pay-booking-number"
            value={bookingNumber}
            onChange={(event) => setBookingNumber(event.target.value)}
            required
            placeholder="BK-2C5FA11D"
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 font-mono uppercase text-slate-950 outline-none ring-cyan-600 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="pay-guest-phone" className="text-sm font-semibold text-slate-700">Cellphone no. used to book</label>
          <input
            id="pay-guest-phone"
            type="tel"
            value={guestPhone}
            onChange={(event) => setGuestPhone(event.target.value)}
            required
            autoComplete="tel"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bolihon-green px-6 py-3 font-bold text-white shadow-md transition hover:bg-bolihon-green-dark disabled:bg-slate-300"
        >
          {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin" /> : <Search aria-hidden="true" className="h-5 w-5 shrink-0" />}
          {loading ? "Finding..." : "Find booking"}
        </button>
      </form>

      {error ? <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {booking ? <BookingPaymentPanel booking={booking} guestPhone={guestPhone} onUpdated={setBooking} /> : null}
    </div>
  );
}

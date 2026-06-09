"use client";

import { useEffect, useState } from "react";
import { canGuestCancel, cancellationWindowDays } from "@/lib/booking-logic";
import { getDemoBookings, updateDemoBooking } from "@/lib/demo-bookings";
import type { Booking } from "@/lib/types";

export function GuestDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [openBookingId, setOpenBookingId] = useState("");

  useEffect(() => {
    const syncBookings = () => setBookings(getDemoBookings());
    syncBookings();
    window.addEventListener("bolihon-bookings-updated", syncBookings);

    return () => window.removeEventListener("bolihon-bookings-updated", syncBookings);
  }, []);

  async function cancelBooking(booking: Booking) {
    const response = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: booking.id,
        action: "cancel",
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
      }),
    });
    const result = (await response.json()) as { message: string };

    setMessage(result.message);
    if (response.ok) {
      updateDemoBooking(booking.id, { status: "cancelled" });
      setBookings((current) =>
        current.map((item) => (item.id === booking.id ? { ...item, status: "cancelled" } : item)),
      );
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg bg-cyan-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">Guest dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">Your upcoming stays</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50">
          Free cancellation is available until {cancellationWindowDays} days before check-in.
        </p>
      </div>

      {message ? <p className="rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const cancellation = canGuestCancel(booking.checkIn);
          const bookingWasMadeInsideFreeWindow = booking.createdAt <= cancellation.cancelBy;
          const canCancel =
            cancellation.allowed &&
            bookingWasMadeInsideFreeWindow &&
            booking.status !== "cancelled";
          const detailsOpen = openBookingId === booking.id;
          const cancellationText = bookingWasMadeInsideFreeWindow
            ? `Cancel by ${cancellation.cancelBy} for free cancellation.`
            : `Free cancellation was already closed when this booking was made on ${booking.createdAt}.`;

          return (
            <article
              key={booking.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenBookingId((current) => (current === booking.id ? "" : booking.id))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpenBookingId((current) => (current === booking.id ? "" : booking.id));
                }
              }}
              className="relative cursor-pointer rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-bolihon-green hover:shadow-md focus:outline-none focus:ring-2 focus:ring-bolihon-green"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <p className="text-sm font-semibold text-cyan-800">{booking.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{booking.roomName}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Guest: {booking.guestName || "Not provided"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {booking.checkIn} to {booking.checkOut} - {booking.guests} guests
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Cellphone: {booking.guestPhone || "Not provided"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {cancellationText}
                  </p>
                </div>
                <div className="grid gap-3 text-left lg:text-right">
                  <div>
                    <p className="text-2xl font-bold text-slate-950">Php{booking.totalPrice.toLocaleString()}</p>
                    <p className="mt-1 text-sm capitalize text-slate-600">
                      {booking.status} - {booking.paymentStatus.replace("_", " ")}
                    </p>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void cancelBooking(booking);
                    }}
                    disabled={!canCancel}
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    {booking.status === "cancelled" ? "Cancelled" : canCancel ? "Cancel booking" : "Cancellation closed"}
                  </button>
                </div>
              </div>
              {detailsOpen ? (
                <div className="absolute left-5 right-5 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-xl shadow-slate-950/15 lg:left-auto lg:w-[420px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Booking details</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">{booking.roomName}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenBookingId("");
                      }}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Booking ID" value={booking.id} />
                    <DetailItem label="Guest" value={booking.guestName || "Not provided"} />
                    <DetailItem label="Cellphone" value={booking.guestPhone || "Not provided"} />
                    <DetailItem label="Email" value={booking.guestEmail || "Not provided"} />
                    <DetailItem label="Check-in" value={booking.checkIn} />
                    <DetailItem label="Check-out" value={booking.checkOut} />
                    <DetailItem label="Guests" value={booking.guests.toString()} />
                    <DetailItem label="Total" value={`Php${booking.totalPrice.toLocaleString()}`} />
                    <DetailItem label="Booking status" value={booking.status} />
                    <DetailItem label="Payment status" value={booking.paymentStatus.replace("_", " ")} />
                    <DetailItem label="Booked on" value={booking.createdAt} />
                    <DetailItem label="Free cancellation" value={bookingWasMadeInsideFreeWindow ? `Until ${cancellation.cancelBy}` : "Closed when booked"} />
                  </dl>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold capitalize text-slate-900">{value}</dd>
    </div>
  );
}

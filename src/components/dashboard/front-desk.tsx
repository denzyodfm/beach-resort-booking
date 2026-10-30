"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  CircleAlert,
  Clock,
  DoorOpen,
  Footprints,
  Loader2,
  Printer,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { readBookingExtras } from "@/lib/booking-row";
import { bookingStatusLabel, formatPeso, paymentStatusLabel, resortTimeZone } from "@/lib/booking-settings";
import { openSalesInvoice } from "@/lib/sales-invoice";
import type { Booking } from "@/lib/types";

type Arrival = Booking & { amountPaid: number };

function toArrival(row: Record<string, unknown>): Arrival {
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(String(row.special_requests || "{}")) || {};
  } catch {
    details = {};
  }
  return {
    id: String(row.id),
    roomId: String(row.room_id || ""),
    roomName: String((row.rooms as { name?: string } | null)?.name || "Cottage"),
    guestName: String(row.guest_name || ""),
    guestEmail: String(row.guest_email || ""),
    guestPhone: String(row.guest_phone || ""),
    checkIn: String(row.check_in || ""),
    checkOut: String(row.check_out || ""),
    guests: Number(row.guest_count || 1),
    totalPrice: Number(row.total_amount || 0),
    status: String(row.status || "pending") as Booking["status"],
    paymentStatus: String(row.payment_status || "unpaid") as Booking["paymentStatus"],
    createdAt: String(row.created_at || ""),
    amountPaid: Number(details.paymentAmountPaid) || 0,
    ...readBookingExtras(row),
  };
}

/**
 * Front desk check-in (SOP 20261001 / 20261002). Starts with the flowchart
 * question "Is the guest reserved?": reserved guests are looked up, their
 * payment checked, then checked in; walk-ins go to the Walk-in tab.
 */
export function FrontDesk({ onWalkIn }: { onWalkIn: () => void }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [rows, setRows] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  // The spinner is switched on by the search actions; background refreshes keep the current list visible.
  useEffect(() => {
    let active = true;
    const url = `/api/admin/front-desk${searched ? `?q=${encodeURIComponent(searched)}` : ""}`;
    const refresh = () => {
      fetch(url)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Unable to load bookings.");
          if (active) setRows((data as Record<string, unknown>[]).map(toArrival));
        })
        .catch((error: Error) => {
          if (!active) return;
          setMessage(error.message || "Unable to load bookings.");
          setRows([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    refresh();
    window.addEventListener("bolihon-bookings-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("bolihon-bookings-updated", refresh);
    };
  }, [searched]);

  async function checkIn(arrival: Arrival) {
    setBusyId(arrival.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/front-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_in", id: arrival.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to check in.");
      setMessage(`${arrival.guestName || "Guest"} is checked in to ${arrival.roomName}. Radio the Beach/Cottage Attendant to guide them.`);
      window.dispatchEvent(new Event("bolihon-bookings-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check in.");
    } finally {
      setBusyId("");
    }
  }

  async function invoice(arrival: Arrival) {
    setBusyId(arrival.id);
    setMessage("");
    try {
      await openSalesInvoice(arrival.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to issue the sales invoice.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-bolihon-green bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-bolihon-green">Is the guest reserved? · Yes</p>
          <p className="mt-1 text-sm text-slate-600">Ask for the booking number, then verify the reservation and the proof of payment.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setMessage("");
              setLoading(true);
              setSearched(query.trim());
            }}
            className="mt-3 flex gap-2"
          >
            <label htmlFor="front-desk-search" className="sr-only">Booking number, guest name or cellphone</label>
            <input
              id="front-desk-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="BK-…, guest name or cellphone"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm outline-none ring-cyan-600 focus:ring-2"
            />
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-bolihon-green px-4 py-2.5 text-sm font-bold text-white hover:bg-bolihon-green-dark">
              <Search aria-hidden="true" className="h-4 w-4" />
              Find
            </button>
            {searched ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setLoading(true);
                  setSearched("");
                }}
                aria-label="Clear search"
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </form>
        </div>
        <button
          type="button"
          onClick={onWalkIn}
          className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-400"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <Footprints aria-hidden="true" className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Is the guest reserved? · No</span>
            <span className="mt-1 block font-display text-lg font-semibold text-slate-950">Walk-in guest → choose a cottage</span>
            <span className="block text-sm text-slate-600">Confirm the rental, check availability, bill, receive cash, issue the sales invoice.</span>
          </span>
        </button>
      </div>

      {message ? <p role="status" className="rounded-xl bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">{message}</p> : null}

      <section className="grid gap-3">
        <h2 className="text-lg font-bold text-slate-950">
          {searched ? `Results for "${searched}"` : `Today's arrivals · ${new Date().toLocaleDateString("en-PH", { timeZone: resortTimeZone, dateStyle: "medium" })}`}
        </h2>
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading bookings…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {searched ? "No booking matches. Check the booking number or try the guest's cellphone." : "No bookings for today yet."}
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((arrival) => (
              <ArrivalCard
                key={arrival.id}
                arrival={arrival}
                busy={busyId === arrival.id}
                onCheckIn={() => void checkIn(arrival)}
                onInvoice={() => void invoice(arrival)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ArrivalCard({
  arrival,
  busy,
  onCheckIn,
  onInvoice,
}: {
  arrival: Arrival;
  busy: boolean;
  onCheckIn: () => void;
  onInvoice: () => void;
}) {
  const paid = arrival.paymentStatus === "paid" || arrival.paymentStatus === "deposit_paid";
  const balance = Math.max(0, arrival.totalPrice - arrival.amountPaid);
  const checkedIn = arrival.status === "checked_in";

  return (
    <article className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${checkedIn ? "border-emerald-300" : paid ? "border-slate-200" : "border-amber-300"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-cyan-800">{arrival.bookingNumber || arrival.id}</p>
          <h3 className="mt-0.5 text-xl font-semibold text-slate-950">{arrival.roomName}</h3>
          <p className="text-sm text-slate-600">
            {arrival.guestName || "Guest"} · {arrival.guestPhone || "no cellphone"} · {arrival.guests} guest{arrival.guests === 1 ? "" : "s"}
          </p>
          {arrival.party && (arrival.party.child || arrival.party.senior) ? (
            <p className="text-xs font-semibold text-slate-700">
              {arrival.party.regular} regular · {arrival.party.child} child{arrival.party.child === 1 ? "" : "ren"} · {arrival.party.senior} senior/PWD
              {arrival.party.senior ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Check senior/PWD ID</span> : null}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">
            {arrival.checkIn}
            {arrival.checkOut !== arrival.checkIn ? ` to ${arrival.checkOut}` : ""}
            {arrival.channel ? ` · ${arrival.channel === "online" ? "Online" : "Walk-in"}` : ""}
            {arrival.bookingType ? ` · ${arrival.bookingType}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${checkedIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {bookingStatusLabel(arrival.status)}
        </span>
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-sm ${paid ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
        {paid ? <BadgeCheck aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
        <span className="font-bold">Proof of payment: {paymentStatusLabel(arrival.paymentStatus)}</span>
        <span>Total {formatPeso(arrival.totalPrice)}</span>
        {balance > 0 && paid ? <span className="font-bold">Balance {formatPeso(balance)}</span> : null}
        {arrival.paymentReference ? <span className="font-mono">Ref {arrival.paymentReference}</span> : null}
        {arrival.invoiceNumber ? <span className="font-mono">{arrival.invoiceNumber}</span> : null}
      </div>
      {!paid ? (
        <p className="mt-2 text-xs text-amber-900">
          {arrival.paymentStatus === "authorized"
            ? "The guest submitted a payment reference that is not verified yet. Verify it in Admin → Payments before checking in."
            : "No payment recorded. Collect payment: open the cottage in the Walk-in or Online Booking tab and tap Record cottage payment."}
        </p>
      ) : null}
      {checkedIn && arrival.checkedInAt ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-800">
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          Checked in {new Date(arrival.checkedInAt).toLocaleTimeString("en-PH", { timeZone: resortTimeZone, timeStyle: "short" })}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={busy || !paid || checkedIn}
          className="inline-flex items-center gap-2 rounded-full bg-bolihon-green px-4 py-2 text-sm font-bold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : checkedIn ? <UserCheck aria-hidden="true" className="h-4 w-4" /> : <DoorOpen aria-hidden="true" className="h-4 w-4" />}
          {checkedIn ? "Checked in" : "Check in"}
        </button>
        <button
          type="button"
          onClick={onInvoice}
          disabled={busy || !paid}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Printer aria-hidden="true" className="h-4 w-4" />
          {arrival.invoiceNumber ? "Reprint sales invoice" : "Issue sales invoice"}
        </button>
        {!arrival.channel || arrival.channel === "walk_in" ? null : (
          <span className="inline-flex items-center gap-1.5 self-center text-xs text-slate-500">
            <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Pre-booked
          </span>
        )}
      </div>
    </article>
  );
}

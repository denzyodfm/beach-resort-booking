"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { bookingStatusLabel, formatPeso, paymentStatusLabel, resortTimeZone } from "@/lib/booking-settings";
import type { Booking } from "@/lib/types";

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Today's date in the resort's time zone, as YYYY-MM-DD. */
function resortToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: resortTimeZone }).format(new Date());
}

/** The resort-time calendar date of an ISO timestamp, as YYYY-MM-DD. */
function resortDateOf(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: resortTimeZone }).format(date);
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week that contains `day`. */
function mondayOf(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

function amountCollected(booking: Booking) {
  return Math.max(0, (booking.paymentAmountPaid || 0) - (booking.refundAmount || 0));
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One-week overview of every booking at Bolihon, Monday to Sunday (resort time).
 * A booking belongs to the week of its check-in date.
 */
export function WeeklySummary({ bookings }: { bookings: Booking[] }) {
  const thisWeek = mondayOf(resortToday());
  const [weekStart, setWeekStart] = useState(thisWeek);
  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => weekdayNames.map((_, index) => addDays(weekStart, index)), [weekStart]);

  const summary = useMemo(() => {
    const inWeek = bookings
      .filter((booking) => booking.checkIn >= weekStart && booking.checkIn <= weekEnd)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomName.localeCompare(b.roomName));
    const active = inWeek.filter((booking) => booking.status !== "cancelled");
    const count = (status: Booking["status"]) => inWeek.filter((booking) => booking.status === status).length;

    return {
      inWeek,
      total: inWeek.length,
      active: active.length,
      confirmed: count("confirmed"),
      checkedIn: count("checked_in"),
      pending: count("pending"),
      cancelled: count("cancelled"),
      guests: active.reduce((sum, booking) => sum + (booking.guests || 0), 0),
      bookedValue: active.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0),
      collected: inWeek.reduce((sum, booking) => sum + amountCollected(booking), 0),
      unpaidBalance: active.reduce((sum, booking) => sum + Math.max(0, booking.totalPrice - (booking.paymentAmountPaid || 0)), 0),
      online: active.filter((booking) => booking.channel !== "walk_in").length,
      walkIn: active.filter((booking) => booking.channel === "walk_in").length,
      madeThisWeek: bookings.filter((booking) => {
        const created = resortDateOf(booking.createdAt);
        return created >= weekStart && created <= weekEnd;
      }).length,
      perDay: days.map((day) => {
        const dayBookings = inWeek.filter((booking) => booking.checkIn === day);
        const dayActive = dayBookings.filter((booking) => booking.status !== "cancelled");
        return {
          day,
          bookings: dayActive.length,
          cancelled: dayBookings.length - dayActive.length,
          guests: dayActive.reduce((sum, booking) => sum + (booking.guests || 0), 0),
          value: dayActive.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0),
          collected: dayBookings.reduce((sum, booking) => sum + amountCollected(booking), 0),
        };
      }),
      byCottage: [...active.reduce((map, booking) => map.set(booking.roomName, (map.get(booking.roomName) || 0) + 1), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    };
  }, [bookings, days, weekStart, weekEnd]);

  const busiest = summary.perDay.reduce((best, day) => (day.bookings > best.bookings ? day : best), summary.perDay[0]);
  const weekLabel = `${formatDay(weekStart)} – ${formatDay(weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;

  function downloadCsv() {
    const header = ["Booking no.", "Check-in", "Check-out", "Cottage", "Guest", "Cellphone", "Guests", "Channel", "Status", "Payment", "Total", "Paid", "Balance"];
    const rows = summary.inWeek.map((booking) => [
      booking.bookingNumber || booking.id,
      booking.checkIn,
      booking.checkOut,
      booking.roomName,
      booking.guestName,
      booking.guestPhone,
      booking.guests,
      booking.channel === "walk_in" ? "Walk-in" : "Online",
      bookingStatusLabel(booking.status),
      paymentStatusLabel(booking.paymentStatus),
      booking.totalPrice,
      booking.paymentAmountPaid || 0,
      Math.max(0, booking.totalPrice - (booking.paymentAmountPaid || 0)),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bolihon-weekly-summary-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Monitoring</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Weekly summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            {weekLabel} · bookings by check-in date{weekStart === thisWeek ? " · this week" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Previous
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(thisWeek)}
            disabled={weekStart === thisWeek}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Next <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!summary.inWeek.length}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-4 w-4" /> Download CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Bookings" value={String(summary.active)} detail={`${summary.confirmed} confirmed · ${summary.checkedIn} checked in · ${summary.pending} pending`} />
        <SummaryTile label="Guests expected" value={String(summary.guests)} detail={`${summary.online} online · ${summary.walkIn} walk-in`} />
        <SummaryTile label="Booked value" value={formatPeso(summary.bookedValue)} detail={`${formatPeso(summary.unpaidBalance)} still unpaid`} />
        <SummaryTile label="Collected" value={formatPeso(summary.collected)} detail="Payments recorded, less refunds" />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <span>
          <strong className="text-slate-900">{summary.cancelled}</strong> cancelled
        </span>
        <span>
          <strong className="text-slate-900">{summary.madeThisWeek}</strong> new bookings made during this week
        </span>
        {busiest && busiest.bookings ? (
          <span>
            Busiest day: <strong className="text-slate-900">{formatDay(busiest.day, { weekday: "long", month: "short", day: "numeric" })}</strong> ({busiest.bookings})
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2 text-right">Bookings</th>
              <th className="px-3 py-2 text-right">Guests</th>
              <th className="px-3 py-2 text-right">Cancelled</th>
              <th className="px-3 py-2 text-right">Booked value</th>
              <th className="px-3 py-2 text-right">Collected</th>
            </tr>
          </thead>
          <tbody>
            {summary.perDay.map((row) => (
              <tr key={row.day} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{formatDay(row.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                <td className="px-3 py-2 text-right">{row.bookings}</td>
                <td className="px-3 py-2 text-right">{row.guests}</td>
                <td className="px-3 py-2 text-right text-slate-500">{row.cancelled}</td>
                <td className="px-3 py-2 text-right">{formatPeso(row.value)}</td>
                <td className="px-3 py-2 text-right">{formatPeso(row.collected)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
            <tr>
              <td className="px-3 py-2">Week total</td>
              <td className="px-3 py-2 text-right">{summary.active}</td>
              <td className="px-3 py-2 text-right">{summary.guests}</td>
              <td className="px-3 py-2 text-right">{summary.cancelled}</td>
              <td className="px-3 py-2 text-right">{formatPeso(summary.bookedValue)}</td>
              <td className="px-3 py-2 text-right">{formatPeso(summary.collected)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {summary.byCottage.length ? (
        <div>
          <h3 className="text-sm font-bold text-slate-900">Bookings per cottage</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.byCottage.map(([name, total]) => (
              <span key={name} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900">
                {name} · {total}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-bold text-slate-900">All bookings this week ({summary.total})</h3>
        {summary.inWeek.length ? (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Check-in</th>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Cottage</th>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2 text-right">Guests</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.inWeek.map((booking) => (
                  <tr key={booking.id} className={`border-t border-slate-100 ${booking.status === "cancelled" ? "text-slate-400" : "text-slate-800"}`}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDay(booking.checkIn, { weekday: "short", month: "short", day: "numeric" })}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{booking.bookingNumber || booking.id}</td>
                    <td className="px-3 py-2">{booking.roomName}</td>
                    <td className="px-3 py-2">
                      {booking.guestName}
                      <span className="block text-xs text-slate-500">{booking.channel === "walk_in" ? "Walk-in" : "Online"}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{booking.guests}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={booking.status} />
                    </td>
                    <td className="px-3 py-2">{paymentStatusLabel(booking.paymentStatus)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatPeso(booking.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No bookings check in during this week.</p>
        )}
      </div>
    </section>
  );
}

function SummaryTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </article>
  );
}

function StatusChip({ status }: { status: Booking["status"] }) {
  const tones: Record<Booking["status"], string> = {
    pending: "bg-amber-100 text-amber-900",
    confirmed: "bg-emerald-100 text-emerald-800",
    checked_in: "bg-cyan-100 text-cyan-900",
    cancelled: "bg-slate-200 text-slate-600",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tones[status]}`}>{bookingStatusLabel(status)}</span>;
}

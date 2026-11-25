"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { bookingStatusLabel, formatPeso, paymentStatusLabel, resortTimeZone } from "@/lib/booking-settings";
import type { Booking } from "@/lib/types";

type PeriodMode = "week" | "month" | "custom";
type GroupBy = "day" | "week" | "month";

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

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

/** Monday of the week that contains `day`. */
function mondayOf(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

function firstOfMonth(day: string) {
  return `${day.slice(0, 7)}-01`;
}

function lastOfMonth(day: string) {
  const date = new Date(`${firstOfMonth(day)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(day: string, months: number) {
  const date = new Date(`${firstOfMonth(day)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

/** Grouping that keeps the breakdown table a readable length for a period of this many days. */
function defaultGroupBy(mode: PeriodMode, lengthInDays: number): GroupBy {
  if (mode === "week") return "day";
  if (mode === "month") return "week";
  return lengthInDays <= 31 ? "day" : lengthInDays <= 120 ? "week" : "month";
}

/** Splits start..end (inclusive) into day, week (Mon-Sun) or month buckets, clipped to the range. */
function buildBuckets(start: string, end: string, groupBy: GroupBy) {
  const buckets: Array<{ start: string; end: string; label: string }> = [];
  let cursor = start;
  while (cursor <= end) {
    const bucketEnd =
      groupBy === "day" ? cursor : groupBy === "week" ? addDays(mondayOf(cursor), 6) : lastOfMonth(cursor);
    const clippedEnd = bucketEnd > end ? end : bucketEnd;
    const label =
      groupBy === "day"
        ? formatDay(cursor, { weekday: "short", month: "short", day: "numeric" })
        : groupBy === "month"
          ? formatDay(cursor, { month: "long", year: "numeric" })
          : cursor === clippedEnd
            ? formatDay(cursor)
            : `${formatDay(cursor)} – ${formatDay(clippedEnd)}`;
    buckets.push({ start: cursor, end: clippedEnd, label });
    cursor = addDays(clippedEnd, 1);
  }
  return buckets;
}

function amountCollected(booking: Booking) {
  return Math.max(0, (booking.paymentAmountPaid || 0) - (booking.refundAmount || 0));
}

function balanceOf(booking: Booking) {
  return Math.max(0, booking.totalPrice - (booking.paymentAmountPaid || 0));
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Overview of every booking at Bolihon for a week, a month or any date range
 * (resort time). A booking belongs to the period of its check-in date.
 */
export function BookingSummary({ bookings }: { bookings: Booking[] }) {
  const today = resortToday();
  const [mode, setMode] = useState<PeriodMode>("week");
  const [anchor, setAnchor] = useState(today);
  const [customStart, setCustomStart] = useState(firstOfMonth(today));
  const [customEnd, setCustomEnd] = useState(today);
  const [groupOverride, setGroupOverride] = useState<GroupBy | null>(null);

  const [start, end] = useMemo((): [string, string] => {
    if (mode === "week") return [mondayOf(anchor), addDays(mondayOf(anchor), 6)];
    if (mode === "month") return [firstOfMonth(anchor), lastOfMonth(anchor)];
    return customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
  }, [mode, anchor, customStart, customEnd]);

  const lengthInDays = daysBetween(start, end) + 1;
  const groupBy = groupOverride ?? defaultGroupBy(mode, lengthInDays);
  const isCurrent =
    mode === "week" ? start === mondayOf(today) : mode === "month" ? start === firstOfMonth(today) : false;

  function changeMode(next: PeriodMode) {
    setMode(next);
    setGroupOverride(null);
  }

  function step(direction: -1 | 1) {
    setAnchor((current) => (mode === "week" ? addDays(current, 7 * direction) : shiftMonth(current, direction)));
  }

  const summary = useMemo(() => {
    const inPeriod = bookings
      .filter((booking) => booking.checkIn >= start && booking.checkIn <= end)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomName.localeCompare(b.roomName));
    const active = inPeriod.filter((booking) => booking.status !== "cancelled");
    const count = (status: Booking["status"]) => inPeriod.filter((booking) => booking.status === status).length;

    const rows = buildBuckets(start, end, groupBy).map((bucket) => {
      const bucketBookings = inPeriod.filter((booking) => booking.checkIn >= bucket.start && booking.checkIn <= bucket.end);
      const bucketActive = bucketBookings.filter((booking) => booking.status !== "cancelled");
      return {
        ...bucket,
        bookings: bucketActive.length,
        cancelled: bucketBookings.length - bucketActive.length,
        guests: bucketActive.reduce((sum, booking) => sum + (booking.guests || 0), 0),
        value: bucketActive.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0),
        collected: bucketBookings.reduce((sum, booking) => sum + amountCollected(booking), 0),
      };
    });

    return {
      inPeriod,
      rows,
      total: inPeriod.length,
      active: active.length,
      confirmed: count("confirmed"),
      checkedIn: count("checked_in"),
      pending: count("pending"),
      cancelled: count("cancelled"),
      guests: active.reduce((sum, booking) => sum + (booking.guests || 0), 0),
      bookedValue: active.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0),
      collected: inPeriod.reduce((sum, booking) => sum + amountCollected(booking), 0),
      unpaidBalance: active.reduce((sum, booking) => sum + balanceOf(booking), 0),
      online: active.filter((booking) => booking.channel !== "walk_in").length,
      walkIn: active.filter((booking) => booking.channel === "walk_in").length,
      madeInPeriod: bookings.filter((booking) => {
        const created = resortDateOf(booking.createdAt);
        return created >= start && created <= end;
      }).length,
      byCottage: [...active.reduce((map, booking) => map.set(booking.roomName, (map.get(booking.roomName) || 0) + 1), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    };
  }, [bookings, start, end, groupBy]);

  const busiest = summary.rows.reduce((best, row) => (row.bookings > best.bookings ? row : best), summary.rows[0]);
  const periodLabel =
    mode === "month"
      ? formatDay(start, { month: "long", year: "numeric" })
      : `${formatDay(start)} – ${formatDay(end, { month: "short", day: "numeric", year: "numeric" })}`;
  const periodNoun = mode === "week" ? "week" : mode === "month" ? "month" : "period";
  const groupNoun = { day: "Day", week: "Week", month: "Month" }[groupBy];

  function downloadCsv() {
    const header = ["Booking no.", "Check-in", "Check-out", "Cottage", "Guest", "Cellphone", "Guests", "Channel", "Status", "Payment", "Total", "Paid", "Balance"];
    const rows = summary.inPeriod.map((booking) => [
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
      balanceOf(booking),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bolihon-bookings-${start}-to-${end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const buttonClass = "inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-50";

  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Monitoring</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Booking summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            {periodLabel} · bookings by check-in date{isCurrent ? ` · this ${periodNoun}` : ""}
          </p>
        </div>
        <Segmented
          label="Period"
          value={mode}
          options={[
            ["week", "Week"],
            ["month", "Month"],
            ["custom", "Custom range"],
          ]}
          onChange={changeMode}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {mode === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <DateInput id="summary-start" label="From" value={customStart} onChange={setCustomStart} />
            <DateInput id="summary-end" label="To" value={customEnd} onChange={setCustomEnd} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => step(-1)} className={buttonClass}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Previous {periodNoun}
            </button>
            <button type="button" onClick={() => setAnchor(today)} disabled={isCurrent} className={buttonClass}>
              This {periodNoun}
            </button>
            <button type="button" onClick={() => step(1)} className={buttonClass}>
              Next {periodNoun} <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!summary.inPeriod.length}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden="true" className="h-4 w-4" /> Download CSV
        </button>
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
          <strong className="text-slate-900">{summary.madeInPeriod}</strong> new bookings made during this {periodNoun}
        </span>
        {busiest && busiest.bookings ? (
          <span>
            Busiest {groupNoun.toLowerCase()}: <strong className="text-slate-900">{busiest.label}</strong> ({busiest.bookings})
          </span>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Breakdown by {groupNoun.toLowerCase()}</h3>
          <Segmented
            label="Group by"
            value={groupBy}
            options={[
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ]}
            onChange={setGroupOverride}
            small
          />
        </div>
        <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{groupNoun}</th>
                <th className="px-3 py-2 text-right">Bookings</th>
                <th className="px-3 py-2 text-right">Guests</th>
                <th className="px-3 py-2 text-right">Cancelled</th>
                <th className="px-3 py-2 text-right">Booked value</th>
                <th className="px-3 py-2 text-right">Collected</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.start} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right">{row.bookings}</td>
                  <td className="px-3 py-2 text-right">{row.guests}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{row.cancelled}</td>
                  <td className="px-3 py-2 text-right">{formatPeso(row.value)}</td>
                  <td className="px-3 py-2 text-right">{formatPeso(row.collected)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{summary.active}</td>
                <td className="px-3 py-2 text-right">{summary.guests}</td>
                <td className="px-3 py-2 text-right">{summary.cancelled}</td>
                <td className="px-3 py-2 text-right">{formatPeso(summary.bookedValue)}</td>
                <td className="px-3 py-2 text-right">{formatPeso(summary.collected)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
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
        <h3 className="text-sm font-bold text-slate-900">All bookings in this {periodNoun} ({summary.total})</h3>
        {summary.inPeriod.length ? (
          <div className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
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
                {summary.inPeriod.map((booking) => (
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
          <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No bookings check in during this {periodNoun}.</p>
        )}
      </div>
    </section>
  );
}

function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string;
  value: Value;
  options: Array<[Value, string]>;
  onChange: (value: Value) => void;
  small?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5">
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          onClick={() => onChange(optionValue)}
          className={`rounded-md font-semibold transition ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
            value === optionValue ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

function DateInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
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

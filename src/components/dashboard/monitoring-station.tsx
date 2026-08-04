"use client";

import { useMemo, useState } from "react";
import { DateCottageBooking } from "@/components/booking/date-cottage-booking";
import type { CottageCategory, Room } from "@/lib/types";

type BookingMode = "walk-in" | "online";

export function MonitoringStation({
  rooms,
  categories,
  resortToday,
}: {
  rooms: Room[];
  categories: CottageCategory[];
  resortToday: string;
}) {
  const [mode, setMode] = useState<BookingMode>("walk-in");
  const visibleRooms = useMemo(
    () => rooms.filter((room) => (mode === "online" ? room.onlineReservable !== false : room.onlineReservable === false)),
    [rooms, mode],
  );

  return (
    <div className="grid gap-6">
      <header className="rounded-2xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">Staff and admin only</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Bolihon Monitoring Station</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          View every assigned cottage by date. Green cells are available; pale or locked cells are already booked, blocked, offline, or unavailable.
        </p>
      </header>

      <div role="tablist" aria-label="Booking channel" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2">
        {([
          ["walk-in", "Walk-in Booking", "Cottages unchecked for online reservations"],
          ["online", "Online Booking", "Cottages checked for online reservations"],
        ] as const).map(([id, label, detail]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-xl p-5 text-left transition ${mode === id ? "bg-bolihon-green text-white shadow-md" : "bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
          >
            <span className="flex items-center justify-between gap-3 text-lg font-bold">
              {label}
              <span className={`rounded-full px-2.5 py-1 text-xs ${mode === id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                {rooms.filter((room) => (id === "online" ? room.onlineReservable !== false : room.onlineReservable === false)).length}
              </span>
            </span>
            <span className={`mt-1 block text-sm ${mode === id ? "text-emerald-50" : "text-slate-500"}`}>{detail}</span>
          </button>
        ))}
      </div>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{mode} availability</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            {mode === "online" ? "Online booking cottages" : "Walk-in booking cottages"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">Choose a month and category to inspect or create a reservation.</p>
        </div>

        {visibleRooms.length ? (
          <DateCottageBooking key={mode} rooms={visibleRooms} categories={categories} resortToday={resortToday} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No cottages are assigned here. Use Admin → Cottages to change a cottage&apos;s online reservation designation.
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ConciergeBell, Footprints, Globe } from "lucide-react";
import { DateCottageBooking } from "@/components/booking/date-cottage-booking";
import { FrontDesk } from "@/components/dashboard/front-desk";
import type { BookingSettings } from "@/lib/booking-settings";
import type { CottageCategory, Room } from "@/lib/types";

type BookingMode = "front-desk" | "walk-in" | "online";

export function MonitoringStation({
  rooms,
  categories,
  resortToday,
  settings,
}: {
  rooms: Room[];
  categories: CottageCategory[];
  resortToday: string;
  settings: BookingSettings;
}) {
  const [mode, setMode] = useState<BookingMode>("front-desk");
  const visibleRooms = useMemo(
    () => rooms.filter((room) => (mode === "online" ? room.onlineReservable !== false : room.onlineReservable === false)),
    [rooms, mode],
  );
  const countFor = (id: BookingMode) =>
    id === "front-desk" ? null : rooms.filter((room) => (id === "online" ? room.onlineReservable !== false : room.onlineReservable === false)).length;

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Front desk sections" className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3">
        {([
          ["front-desk", "Front desk", "Arrivals, check-in and sales invoices", ConciergeBell],
          ["walk-in", "Walk-in", "Cottages unchecked for online reservations", Footprints],
          ["online", "Online Booking", "Cottages checked for online reservations", Globe],
        ] as const).map(([id, label, detail, Icon]) => {
          const count = countFor(id);
          return (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg px-4 py-3 text-left transition ${mode === id ? "bg-bolihon-green text-white shadow-md" : "bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
            >
              <span className="flex items-center justify-between gap-3 text-lg font-bold">
                <span className="inline-flex items-center gap-2">
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {label}
                </span>
                {count !== null ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs ${mode === id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>{count}</span>
                ) : null}
              </span>
              <span className={`mt-1 block text-sm ${mode === id ? "text-emerald-50" : "text-slate-500"}`}>{detail}</span>
            </button>
          );
        })}
      </div>

      {mode === "front-desk" ? (
        <FrontDesk onWalkIn={() => setMode("walk-in")} />
      ) : (
        <section className="grid gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{mode} availability</p>
            <h2 className="text-xl font-bold text-slate-950">
              {mode === "online" ? "Online booking cottages" : "Walk-in cottages"}
            </h2>
            <p className="text-sm text-slate-600">{mode === "walk-in" ? `Showing walk-in availability for today, ${resortToday}.` : "Choose a month and category to inspect or create a reservation."}</p>
          </div>

          {visibleRooms.length ? (
            <DateCottageBooking key={mode} rooms={visibleRooms} categories={categories} resortToday={resortToday} settings={settings} todayOnly={mode === "walk-in"} compact />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No cottages are assigned here. Use Admin → Cottages to change a cottage&apos;s online reservation designation.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

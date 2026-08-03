"use client";

import { useEffect, useMemo, useState } from "react";
import type { CottageCategory, Room } from "@/lib/types";

type Catalog = { rooms: Room[]; categories: CottageCategory[] };
type BookingMode = "walk-in" | "online";

export function MonitoringStation() {
  const [mode, setMode] = useState<BookingMode>("walk-in");
  const [cottages, setCottages] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/rooms")
      .then((response) => response.json())
      .then((data: Catalog | Room[]) => setCottages(Array.isArray(data) ? data : data.rooms))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => cottages.filter((room) => mode === "online" ? room.onlineReservable !== false : room.onlineReservable === false),
    [cottages, mode],
  );

  return (
    <div className="grid gap-6">
      <header className="rounded-2xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">Staff and admin only</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Bolihon Monitoring Station</h1>
        <p className="mt-3 max-w-3xl text-slate-300">Choose a booking channel to see only the cottages assigned to that channel.</p>
      </header>

      <div role="tablist" aria-label="Booking channel" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2">
        {([ ["walk-in", "Walk-in Booking", "Cottages not designated for online reservations"], ["online", "Online Booking", "Cottages available through online reservations"] ] as const).map(([id, label, detail]) => (
          <button key={id} role="tab" aria-selected={mode === id} type="button" onClick={() => setMode(id)} className={`rounded-xl p-5 text-left transition ${mode === id ? "bg-bolihon-green text-white shadow-md" : "bg-slate-50 text-slate-900 hover:bg-slate-100"}`}>
            <span className="block text-lg font-bold">{label}</span>
            <span className={`mt-1 block text-sm ${mode === id ? "text-emerald-50" : "text-slate-500"}`}>{detail}</span>
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{mode} cottages</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{mode === "online" ? "Online booking cottages" : "Walk-in booking cottages"}</h2></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{visible.length} cottages</span>
        </div>
        {loading ? <p className="mt-6 text-slate-500">Loading cottages...</p> : visible.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((room) => <article key={room.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{room.name}</h3><p className="mt-1 text-sm text-slate-500">{room.categoryName}</p></div><span className={`h-3 w-3 rounded-full ${room.available === false ? "bg-slate-400" : "bg-emerald-500"}`} /></div><p className="mt-4 font-semibold text-cyan-900">Php{room.pricePerNight.toLocaleString()}/day</p><p className="mt-1 text-xs text-slate-500">{room.available === false ? "Currently offline" : "Available for booking"}</p></article>)}
          </div>
        ) : <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">No cottages are assigned here. Use Admin → Cottages to change a cottage’s online reservation designation.</div>}
      </section>
    </div>
  );
}

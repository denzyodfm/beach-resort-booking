"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Room } from "@/lib/types";

export function CottageCarousel({ rooms }: { rooms: Room[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (rooms.length < 2) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % rooms.length);
    }, 5500);

    return () => window.clearInterval(intervalId);
  }, [rooms.length]);

  const activeRoom = rooms[activeIndex] ?? rooms[0];

  if (!activeRoom) return null;

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + rooms.length) % rooms.length);
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % rooms.length);
  }

  return (
    <section className="relative min-h-[calc(100vh-5.75rem)] overflow-hidden bg-cyan-950 text-white">
      <img
        src={activeRoom.image}
        alt={activeRoom.name}
        className="absolute inset-0 h-full w-full object-cover opacity-85"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-slate-950/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5.75rem)] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-100">
            BOLIHON Beach Resort
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
            {activeRoom.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50">
            {activeRoom.description}
          </p>

          <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-white/15 px-4 py-2 backdrop-blur">{activeRoom.type}</span>
            <span className="rounded-full bg-white/15 px-4 py-2 backdrop-blur">
              Php{activeRoom.pricePerNight.toLocaleString()} per day
            </span>
            <span className="rounded-full bg-white/15 px-4 py-2 backdrop-blur">
              {activeRoom.maxGuests} guests
            </span>
            <span className="rounded-full bg-white/15 px-4 py-2 backdrop-blur">{activeRoom.size}</span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/booking?room=${activeRoom.id}`}
              className="rounded-full bg-bolihon-green px-6 py-3 text-center font-semibold text-white transition hover:bg-bolihon-green-dark"
            >
              Book this cottage
            </Link>
            <Link
              href={`/rooms/${activeRoom.slug}`}
              className="rounded-full border border-white/70 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              View details
            </Link>
          </div>
        </div>

        <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-xl flex-1 gap-2">
              {rooms.map((room, index) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 flex-1 rounded-full transition ${
                    index === activeIndex ? "bg-white" : "bg-white/35 hover:bg-white/60"
                  }`}
                  aria-label={`Show ${room.name}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                />
              ))}
            </div>
            <div className="flex gap-2">
            <button
              type="button"
              onClick={showPrevious}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/15 text-lg font-bold text-white backdrop-blur transition hover:bg-white/25"
              aria-label="Show previous cottage"
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={showNext}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/15 text-lg font-bold text-white backdrop-blur transition hover:bg-white/25"
              aria-label="Show next cottage"
            >
              &gt;
            </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

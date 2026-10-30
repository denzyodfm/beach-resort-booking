"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Footprints, Info, MapPin, Pause, Play, Users } from "lucide-react";
import type { Room } from "@/lib/types";

export function CottageCarousel({ rooms }: { rooms: Room[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (rooms.length < 2 || paused || hovering) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % rooms.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [rooms.length, paused, hovering]);

  const activeRoom = rooms[activeIndex] ?? rooms[0];

  if (!activeRoom) return null;

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + rooms.length) % rooms.length);
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % rooms.length);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured cottages"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="relative isolate overflow-hidden bg-cyan-950 text-white"
    >
      {rooms.map((room, index) => (
        <img
          key={room.id}
          src={room.image}
          alt=""
          aria-hidden="true"
          loading={index === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-1000 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-950/90 via-cyan-950/45 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-cyan-950/80 via-transparent to-cyan-950/30" />

      <div className="mx-auto grid min-h-[min(88dvh,820px)] max-w-7xl content-center gap-10 px-4 pb-36 pt-16 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:px-8">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-cove backdrop-blur">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Carmen · Agusan del Norte
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            Slow days on the <span className="text-cove">Bolihon</span> shore.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-cyan-50/90">
            Beachfront cottages, rock-garden hideaways and open-air pavilions for families, barkadas and celebrations.
            Book online in minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/booking-by-date"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cove px-7 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-white"
            >
              <CalendarCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
              Check availability
            </Link>
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/50 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Info aria-hidden="true" className="h-5 w-5 shrink-0" />
              Explore cottages
            </Link>
          </div>
        </div>

        <article
          aria-live="polite"
          aria-label={`Featured cottage ${activeIndex + 1} of ${rooms.length}`}
          className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur-md"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cove">Featured cottage</p>
          <h2 className="mt-2 text-3xl font-semibold">{activeRoom.name}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-cyan-50/85">{activeRoom.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1">Php{activeRoom.pricePerNight.toLocaleString()} / day</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
              <Users aria-hidden="true" className="h-3.5 w-3.5" />
              {activeRoom.maxGuests} guests
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {activeRoom.onlineReservable === false ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-full bg-black/30 px-4 py-2 text-sm font-semibold">
                <Footprints aria-hidden="true" className="h-4 w-4 shrink-0" />
                Walk-in only
              </span>
            ) : (
              <Link
                href={`/booking?room=${activeRoom.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-cove"
              >
                <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                Book this cottage
              </Link>
            )}
            <Link
              href={`/rooms/${activeRoom.slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
              Details
            </Link>
          </div>

          {rooms.length > 1 ? (
            <div className="mt-5 flex items-center gap-3 border-t border-white/15 pt-4">
              <div className="flex flex-1 gap-1.5">
                {rooms.map((room, index) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-1.5 flex-1 rounded-full transition ${index === activeIndex ? "bg-cove" : "bg-white/30 hover:bg-white/60"}`}
                    aria-label={`Show ${room.name}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                  />
                ))}
              </div>
              <CarouselButton label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused((value) => !value)}>
                {paused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
              </CarouselButton>
              <CarouselButton label="Show previous cottage" onClick={showPrevious}>
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </CarouselButton>
              <CarouselButton label="Show next cottage" onClick={showNext}>
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </CarouselButton>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function CarouselButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-white/10 text-white transition hover:bg-white/25"
    >
      {children}
    </button>
  );
}

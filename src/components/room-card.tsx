import Link from "next/link";
import { BedDouble, CalendarCheck, Footprints, Info, Maximize2, Users } from "lucide-react";
import { BookingChannelBadge } from "@/components/booking-channel-badge";
import { getBookingChannel } from "@/lib/booking-settings";
import type { Room } from "@/lib/types";

export function RoomCard({ room }: { room: Room }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/rooms/${room.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-cyan-50">
        <img
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={room.image}
          alt={room.name}
          loading="lazy"
          decoding="async"
        />
        <span className="absolute left-3 top-3">
          <BookingChannelBadge room={room} className="shadow-md" />
        </span>
        <span className="absolute bottom-3 right-3 rounded-2xl bg-white/95 px-3 py-1.5 text-right shadow-md backdrop-blur">
          <span className="block font-display text-lg font-bold leading-tight text-slate-950">Php{room.pricePerNight.toLocaleString()}</span>
          <span className="block text-[11px] font-medium text-slate-500">per day</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{room.categoryName || room.type}</p>
        <h3 className="mt-1.5 text-xl font-semibold text-slate-950">{room.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{room.description}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5"><Users aria-hidden="true" className="h-4 w-4 text-cyan-700" />{room.maxGuests} guests</span>
          <span className="inline-flex items-center gap-1.5"><BedDouble aria-hidden="true" className="h-4 w-4 text-cyan-700" />{room.bedrooms} bedroom</span>
          {room.size ? <span className="inline-flex items-center gap-1.5"><Maximize2 aria-hidden="true" className="h-4 w-4 text-cyan-700" />{room.size}</span> : null}
        </div>
        <div className="mt-auto flex gap-3 pt-5">
          <Link
            href={`/rooms/${room.slug}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:border-cyan-700 hover:text-cyan-800"
          >
            <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
            Details
          </Link>
          {getBookingChannel(room) === "walk_in" ? (
            <span className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-500" title="Book this cottage at the resort">
              <Footprints aria-hidden="true" className="h-4 w-4 shrink-0" />
              Walk-in at resort
            </span>
          ) : (
            <Link
              href={`/booking?room=${room.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-bolihon-green px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
            >
              <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
              Book
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

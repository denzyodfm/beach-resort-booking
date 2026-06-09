import Link from "next/link";
import type { Room } from "@/lib/types";

export function RoomCard({ room }: { room: Room }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/rooms/${room.slug}`}>
        <img
          className="h-52 w-full bg-cyan-50 object-cover sm:h-56"
          src={room.image}
          alt={room.name}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              {room.type}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">{room.name}</h3>
          </div>
          <p className="text-right text-lg font-bold text-slate-950">
            Php{room.pricePerNight.toLocaleString()}
            <span className="block text-xs font-medium text-slate-500">per day</span>
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{room.description}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="rounded-full bg-cyan-50 px-3 py-1">{room.maxGuests} guests</span>
          <span className="rounded-full bg-cyan-50 px-3 py-1">{room.bedrooms} bedroom</span>
          <span className="rounded-full bg-cyan-50 px-3 py-1">{room.size}</span>
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            href={`/rooms/${room.slug}`}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-800 transition hover:border-cyan-700 hover:text-cyan-800"
          >
            Details
          </Link>
          <Link
            href={`/booking?room=${room.id}`}
            className="flex-1 rounded-full bg-bolihon-green px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
          >
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}

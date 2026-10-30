import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { BookingChannelBadge } from "@/components/booking-channel-badge";
import { getBookingChannel } from "@/lib/booking-settings";
import { rooms } from "@/lib/resort-data";
import { getRoomBySlugFromCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return rooms.map((room) => ({ slug: room.slug }));
}

export default async function RoomDetailPage(props: PageProps<"/rooms/[slug]">) {
  const { slug } = await props.params;
  const room = await getRoomBySlugFromCatalog(slug);

  if (!room) notFound();

  return (
    <article>
      <section className="relative min-h-[62vh] px-4 py-16 text-white sm:px-6 lg:px-8">
        <img
          src={room.image}
          alt={room.name}
          className="absolute inset-0 h-full w-full bg-cyan-950 object-cover"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-cyan-950/55" />
        <div className="relative mx-auto flex min-h-[46vh] max-w-7xl flex-col justify-end">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-100">{room.type}</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold">{room.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-cyan-50">{room.description}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            {room.gallery.map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`${room.name} gallery ${index + 1}`}
                className="h-56 w-full rounded-lg bg-cyan-50 object-cover"
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
          <h2 className="mt-10 text-3xl font-bold text-slate-950">A closer look</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">{room.longDescription}</p>
          <h2 className="mt-10 text-2xl font-bold text-slate-950">Booking includes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {room.bookingIncludes.map((item) => (
              <div key={item} className="rounded-lg border border-cyan-100 bg-cyan-50 p-4 font-semibold text-cyan-950">
                {item}
              </div>
            ))}
          </div>
          <h2 className="mt-10 text-2xl font-bold text-slate-950">Amenities</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {room.amenities.map((amenity) => (
              <div key={amenity} className="rounded-lg border border-slate-200 bg-white p-4 font-semibold text-slate-800">
                {amenity}
              </div>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">From</p>
          <p className="mt-2 text-4xl font-bold text-slate-950">Php{room.pricePerNight.toLocaleString()}<span className="text-base font-medium text-slate-500"> / day</span></p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-600">
            <span>{room.maxGuests} guests</span>
            <span>{room.bedrooms} bedrooms</span>
            <span>{room.bathrooms} baths</span>
            <span>{room.size}</span>
          </div>
          <BookingChannelBadge room={room} className="mt-6" />
          {getBookingChannel(room) === "walk_in" ? (
            <p className="mt-4 rounded-xl border-2 border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="block text-base text-slate-950">Walk-in guests only</strong>
              This cottage is kept for guests who book at the resort and cannot be reserved online.{" "}
              <Link href="/booking-by-date" className="font-semibold text-cyan-700 underline">See online cottages</Link>
            </p>
          ) : (
            <>
              <Link href={`/booking?room=${room.id}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-center font-semibold text-white transition hover:bg-bolihon-green-dark">
                <CalendarCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
                Book this cottage
              </Link>
              <p className="mt-2 text-center text-xs text-slate-500">
                Choosing this exact cottage is a Premium booking. Pay online within the deadline shown after booking.
              </p>
            </>
          )}
        </aside>
      </section>
    </article>
  );
}

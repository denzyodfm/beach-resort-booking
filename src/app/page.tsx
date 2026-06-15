import Link from "next/link";
import { CottageCarousel } from "@/components/cottage-carousel";
import { getPublishedReviews } from "@/lib/reviews-server";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

const amenities = ["Lagoon pool", "Beach club", "Spa pavilion", "Sunset dining", "Water sports", "Airport transfers"];

function getRandomItems<T>(items: T[], count: number) {
  return [...items]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, items.length));
}

export default async function Home() {
  const [{ rooms }, reviews] = await Promise.all([getRoomCatalog(), getPublishedReviews()]);
  const randomCottages = getRandomItems(rooms, 8);
  const randomReviews = getRandomItems(reviews, 3);

  return (
    <>
      <CottageCarousel rooms={randomCottages} />

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Amenities</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Everything close, nothing rushed</h2>
            <p className="mt-4 text-slate-600">A full resort experience with booking, guest, and admin surfaces ready to connect to Supabase.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((amenity) => (
              <div key={amenity} className="rounded-lg border border-cyan-100 bg-cyan-50 p-5 font-semibold text-cyan-950">
                {amenity}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms[0].gallery.slice(1).map((image, index) => (
            <img key={image} src={image} alt={`BOLIHON gallery ${index + 2}`} className="h-72 w-full rounded-lg object-cover shadow-sm" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {randomReviews.map((review) => (
            <figure key={review.id} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-cyan-800">{review.roomName}</p>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                  {review.rating}/5
                </span>
              </div>
              <blockquote className="text-lg font-semibold leading-7 text-slate-950">
                &ldquo;{review.title || review.body}&rdquo;
              </blockquote>
              {review.title ? <p className="mt-3 text-sm leading-6 text-slate-600">{review.body}</p> : null}
              <figcaption className="mt-4 text-sm text-slate-600">{review.guestName}</figcaption>
            </figure>
          ))}
          {randomReviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 md:col-span-3">
              No approved reviews yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-cyan-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-100">Ready when you are</p>
            <h2 className="mt-2 text-3xl font-bold">Check dates and request a booking in under a minute.</h2>
          </div>
          <Link href="/booking" className="rounded-full bg-bolihon-green px-6 py-3 text-center font-semibold text-white transition hover:bg-bolihon-green-dark">
            Start booking
          </Link>
        </div>
      </section>
    </>
  );
}

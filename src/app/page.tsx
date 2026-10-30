import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Footprints,
  Home as HomeIcon,
  Navigation,
  Plane,
  Quote,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Trees,
  Utensils,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { CottageCarousel } from "@/components/cottage-carousel";
import { ReservationPolicies } from "@/components/reservation-policies";
import { getBookingSettings } from "@/lib/booking-settings-server";
import { getPublishedReviews } from "@/lib/reviews-server";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

const quickActions: Array<{ href: string; title: string; body: string; icon: LucideIcon }> = [
  { href: "/booking-by-date", title: "Book by date", body: "See every free cottage on a calendar", icon: CalendarCheck },
  { href: "/rooms", title: "Browse cottages", body: "Compare rates, photos and capacity", icon: Search },
  { href: "/pay", title: "Pay / track booking", body: "Submit your payment reference", icon: CreditCard },
];

const highlights: Array<{ title: string; body: string; icon: LucideIcon }> = [
  { title: "Steps from the water", body: "Cottages line the cove path, with shade, porches and private baths.", icon: Waves },
  { title: "Book and pay online", body: "Reserve in minutes, pay by GCash or bank, and track it anytime.", icon: ShieldCheck },
  { title: "Walk-ins welcome", body: "Some cottages are always kept for guests who arrive at the resort.", icon: Footprints },
  { title: "Easy to reach", body: "About 50 minutes from Butuan City along the national highway.", icon: Navigation },
];

const amenities: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Lagoon pool", icon: Waves },
  { label: "Beach club", icon: Sun },
  { label: "Spa pavilion", icon: Trees },
  { label: "Sunset dining", icon: Utensils },
  { label: "Water sports", icon: Waves },
  { label: "Airport transfers", icon: Plane },
];

function getRandomItems<T>(items: T[], count: number) {
  return [...items]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, items.length));
}

export default async function Home() {
  const [{ rooms, categories }, reviews, settings] = await Promise.all([getRoomCatalog(), getPublishedReviews(), getBookingSettings()]);
  const randomCottages = getRandomItems(rooms, 8);
  const randomReviews = getRandomItems(reviews, 3);
  const categoryCards = categories
    .map((category) => {
      const categoryRooms = rooms.filter((room) => room.categoryId === category.id);
      return {
        ...category,
        image: categoryRooms[0]?.image,
        count: categoryRooms.length,
        from: categoryRooms.length ? Math.min(...categoryRooms.map((room) => room.pricePerNight)) : 0,
      };
    })
    .filter((category) => category.count > 0);

  return (
    <>
      <CottageCarousel rooms={randomCottages} />

      {/* Quick actions overlap the bottom of the hero. */}
      <section className="relative z-10 mx-auto -mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 rounded-3xl border border-emerald-900/10 bg-white p-3 shadow-[var(--shadow-lift)] sm:grid-cols-3">
          {quickActions.map(({ href, title, body, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-emerald-50"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-bolihon-green transition group-hover:bg-bolihon-green group-hover:text-white">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-slate-950">{title}</span>
                <span className="block text-sm text-slate-500">{body}</span>
              </span>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-bolihon-green" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ title, body, icon: Icon }) => (
            <div key={title}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {categoryCards.length ? (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Stay your way</p>
              <h2 className="mt-2 text-4xl font-semibold text-slate-950">Cottages for every kind of beach day</h2>
            </div>
            <Link href="/rooms" className="inline-flex items-center gap-2 font-semibold text-bolihon-green hover:underline">
              View all cottages
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categoryCards.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/rooms?category=${category.id}`}
                className="group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl bg-cyan-950 p-6 text-white shadow-[var(--shadow-card)]"
              >
                {category.image ? (
                  <img
                    src={category.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-cyan-950/90 via-cyan-950/30 to-transparent" />
                <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                  {category.count} {category.count === 1 ? "space" : "cottages"}
                </span>
                <h3 className="mt-3 text-2xl font-semibold">{category.name}</h3>
                <p className="mt-1 flex items-center justify-between gap-3 text-sm text-cyan-50/90">
                  <span>From Php{category.from.toLocaleString()} / day</span>
                  <ArrowRight aria-hidden="true" className="h-5 w-5 transition group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <ReservationPolicies settings={settings} />
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Amenities</p>
            <h2 className="mt-2 text-4xl font-semibold text-slate-950">Everything close, nothing rushed</h2>
            <p className="mt-4 text-slate-600">Spend the day by the water, then gather your group under the trees.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-background p-4 font-semibold text-slate-800">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-bolihon-green">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:px-8">
        {rooms[0]?.gallery.length ? (
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            {rooms[0].gallery.slice(1, 3).map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`BOLIHON Cove view ${index + 1}`}
                loading="lazy"
                className="h-80 w-full rounded-3xl object-cover shadow-[var(--shadow-card)]"
              />
            ))}
          </div>
        ) : null}

        <div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Guest stories</p>
              <h2 className="mt-2 text-4xl font-semibold text-slate-950">What guests say</h2>
            </div>
            <Link href="/reviews" className="inline-flex items-center gap-2 font-semibold text-bolihon-green hover:underline">
              All reviews
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {randomReviews.map((review) => (
              <figure key={review.id} className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-3">
                  <Quote aria-hidden="true" className="h-7 w-7 text-cove" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                    <Star aria-hidden="true" className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {review.rating}/5
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 font-display text-lg font-medium leading-7 text-slate-950">
                  &ldquo;{review.title || review.body}&rdquo;
                </blockquote>
                {review.title ? <p className="mt-3 text-sm leading-6 text-slate-600">{review.body}</p> : null}
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 text-sm">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                    {review.guestName.trim().charAt(0).toUpperCase() || "G"}
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-900">{review.guestName}</span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <HomeIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      {review.roomName}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
            {randomReviews.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 md:col-span-3">
                No approved reviews yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-800 via-cyan-900 to-emerald-900 px-6 py-14 text-white shadow-[var(--shadow-lift)] sm:px-12">
          <Waves aria-hidden="true" className="absolute -right-10 -top-10 h-64 w-64 text-white/5" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-cove">Ready when you are</p>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold sm:text-4xl">Check dates and book your cottage in under a minute.</h2>
            </div>
            <Link
              href="/booking-by-date"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-cove px-7 py-3.5 text-base font-bold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-white"
            >
              <CalendarCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
              Start booking
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

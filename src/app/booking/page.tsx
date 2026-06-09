import { BookingForm } from "@/components/booking/booking-form";
import { rooms } from "@/lib/resort-data";

export default async function BookingPage(props: PageProps<"/booking">) {
  const searchParams = await props.searchParams;
  const initialRoomId = typeof searchParams.room === "string" ? searchParams.room : undefined;

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Reservations</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Plan your beach stay</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Select dates, guests, and a cottage to calculate the total. The availability check calls a Next route handler and can use Supabase bookings when configured.
        </p>
        <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Booking includes</h2>
          <ul className="mt-4 grid gap-3 text-slate-600">
            <li>Daily breakfast and resort transfers</li>
            <li>Flexible payment status tracking</li>
            <li>Guest dashboard visibility after sign in</li>
          </ul>
        </div>
      </div>
      <BookingForm rooms={rooms} initialRoomId={initialRoomId} />
    </section>
  );
}

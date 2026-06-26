import { DateCottageBooking } from "@/components/booking/date-cottage-booking";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function BookingByDatePage() {
  const { rooms, categories } = await getRoomCatalog();

  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Date-first booking</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Pick a date, then choose a cottage</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Select one resort date to see every cottage plotted by category. Reserved cottages are locked from booking;
          admin users can see the reservation owner while guests only see the unavailable status.
        </p>
      </div>
      <DateCottageBooking rooms={rooms} categories={categories} />
    </section>
  );
}

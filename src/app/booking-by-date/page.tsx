import { DateCottageBooking } from "@/components/booking/date-cottage-booking";
import { ReservationPolicies } from "@/components/reservation-policies";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function BookingByDatePage() {
  const { rooms, categories } = await getRoomCatalog();
  const onlineRooms = rooms.filter((room) => room.onlineReservable !== false);
  const resortToday = getResortToday();

  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">Date-first booking</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Pick a date, then choose a cottage</h1>
        <p className="mt-2 text-base leading-6 text-slate-600">
          Select one resort date to see every cottage plotted by category. Reserved cottages are locked from booking;
          admin users can see the reservation owner while guests only see the unavailable status.
        </p>
      </div>
      <DateCottageBooking rooms={onlineRooms} categories={categories} resortToday={resortToday} />
      <ReservationPolicies />
    </section>
  );
}

function getResortToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

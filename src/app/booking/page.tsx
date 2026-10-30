import { BookingForm } from "@/components/booking/booking-form";
import { ReservationPolicies } from "@/components/reservation-policies";
import { getBookingChannel, typicalHoldHours } from "@/lib/booking-settings";
import { getBookingSettings } from "@/lib/booking-settings-server";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function BookingPage(props: PageProps<"/booking">) {
  const searchParams = await props.searchParams;
  const requestedRoomId = typeof searchParams.room === "string" ? searchParams.room : undefined;
  const [{ rooms, categories }, settings] = await Promise.all([getRoomCatalog(), getBookingSettings()]);
  // Walk-in cottages are not offered online, even when linked to directly.
  const onlineRooms = rooms.filter((room) => getBookingChannel(room) === "online");
  const requestedRoom = rooms.find((room) => room.id === requestedRoomId);
  const initialRoomId = onlineRooms.some((room) => room.id === requestedRoomId) ? requestedRoomId : undefined;
  const initialRoom = onlineRooms.find((room) => room.id === initialRoomId) || onlineRooms[0];
  const bookingIncludes = initialRoom?.bookingIncludes?.length ? initialRoom.bookingIncludes : [];
  const holdHours = typicalHoldHours(onlineRooms);

  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <ReservationPolicies settings={settings} holdHours={holdHours} />
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Reservations</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">Plan your beach stay</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Select dates and guests, then choose Standard (we assign a cottage) or Premium (you pick the cottage). After
            booking you pay online and enter your payment reference number.
          </p>
          {requestedRoom && !initialRoomId ? (
            <p role="alert" className="mt-6 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 font-semibold text-amber-950">
              {requestedRoom.name} is reserved for walk-in guests and cannot be booked online. Choose an online cottage, or
              visit the resort to book it as a walk-in.
            </p>
          ) : null}
          <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Booking includes</h2>
            <ul className="mt-4 grid gap-3 text-slate-600">
              {bookingIncludes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <BookingForm rooms={onlineRooms} categories={categories} initialRoomId={initialRoomId} settings={settings} />
      </div>
    </section>
  );
}

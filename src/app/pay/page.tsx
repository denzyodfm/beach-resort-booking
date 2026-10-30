import { PayLookup } from "@/components/booking/pay-lookup";

export const metadata = {
  title: "Pay / track booking | BOLIHON",
};

export default async function PayPage(props: PageProps<"/pay">) {
  const searchParams = await props.searchParams;
  const bookingNumber = typeof searchParams.booking === "string" ? searchParams.booking : "";

  return (
    <section className="mx-auto grid max-w-2xl gap-6 px-4 py-10 sm:px-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Online payment</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Pay / track your booking</h1>
        <p className="mt-3 text-slate-600">
          Enter your booking number and the cellphone number you booked with to see your payment deadline, pay online and
          submit your payment reference number.
        </p>
      </header>
      <PayLookup initialBookingNumber={bookingNumber} />
    </section>
  );
}

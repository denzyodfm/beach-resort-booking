import Link from "next/link";
import { AlarmClock, CreditCard, Globe, type LucideIcon, Star, Ticket, Users, Wifi } from "lucide-react";
import { formatPeso, type BookingSettings } from "@/lib/booking-settings";

/**
 * The online booking rules, shown at the top of every booking page so guests
 * see the payment deadline and fees before they pick a cottage.
 */
export function ReservationPolicies({ settings, holdHours = 24 }: { settings: BookingSettings; holdHours?: number }) {
  const rules: Array<{ title: string; body: string; tone: string; icon: LucideIcon }> = [
    {
      title: `Pay within ${holdHours} hours`,
      body: "Your booking shows its exact payment deadline. Unpaid reservations are cancelled automatically after it and the cottage is released.",
      tone: "border-rose-300 bg-rose-50 text-rose-950",
      icon: AlarmClock,
    },
    {
      title: "Online payment + reference no.",
      body: "Online bookings are paid online (GCash or bank). Submit your payment reference number so the resort can verify it.",
      tone: "border-cyan-300 bg-cyan-50 text-cyan-950",
      icon: CreditCard,
    },
    {
      title: "Online cottages only",
      body: "Selected cottages are for online booking. The remaining cottages are kept for walk-in guests at the resort.",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-950",
      icon: Globe,
    },
    {
      title: settings.reservationFeeAmount > 0 ? `Reservation fee ${formatPeso(settings.reservationFeeAmount)}` : "Reservation fee",
      body: "A reservation fee is added to every online booking.",
      tone: "border-slate-300 bg-white text-slate-950",
      icon: Ticket,
    },
    {
      title: settings.premiumFeeAmount > 0 ? `Premium booking +${formatPeso(settings.premiumFeeAmount)}` : "Premium booking",
      body: "Want a specific cottage? Choose Premium to pick it yourself. Standard bookings get an available cottage assigned.",
      tone: "border-amber-300 bg-amber-50 text-amber-950",
      icon: Star,
    },
    ...(settings.entranceFeeAmount > 0
      ? [
          {
            title: `Entrance fee ${formatPeso(settings.entranceFeeAmount)} per guest`,
            body: [
              (settings.entranceFeeChildAmount ?? settings.entranceFeeAmount) !== settings.entranceFeeAmount
                ? `Children ${settings.entranceFeeChildAmount ? formatPeso(settings.entranceFeeChildAmount) : "free"}.`
                : "",
              (settings.entranceFeeSeniorAmount ?? settings.entranceFeeAmount) !== settings.entranceFeeAmount
                ? `Senior citizen / PWD ${settings.entranceFeeSeniorAmount ? formatPeso(settings.entranceFeeSeniorAmount) : "free"}.`
                : "",
              settings.entranceFeeNote || "Added for each guest and paid with your booking.",
            ]
              .filter(Boolean)
              .join(" "),
            tone: "border-teal-300 bg-teal-50 text-teal-950",
            icon: Users,
          },
        ]
      : []),
    ...(settings.internetFeeAmount > 0
      ? [
          {
            title: `Internet access +${formatPeso(settings.internetFeeAmount)}`,
            body: "Wi-Fi is an optional add-on you can tick when booking.",
            tone: "border-violet-300 bg-violet-50 text-violet-950",
            icon: Wifi,
          },
        ]
      : []),
  ];

  return (
    <aside className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-lg sm:p-5" aria-labelledby="reservation-policies-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">Read before booking</p>
          <h2 id="reservation-policies-title" className="mt-1 text-2xl font-black text-slate-950">
            Online booking rules
          </h2>
        </div>
        <Link
          href="/pay"
          className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 px-4 py-2 text-center text-sm font-bold text-slate-900 transition hover:bg-slate-900 hover:text-white"
        >
          <CreditCard aria-hidden="true" className="h-4 w-4 shrink-0" />
          Already booked? Pay / track booking →
        </Link>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <li key={rule.title} className={`flex gap-3 rounded-xl border-2 p-3 ${rule.tone}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-black text-white">
              <rule.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            </span>
            <span>
              <span className="block font-black">{rule.title}</span>
              <span className="mt-1 block text-sm leading-5 opacity-90">{rule.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

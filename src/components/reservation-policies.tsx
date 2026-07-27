const reservationPolicies = [
  "Cottages designated for online reservations are reserved exclusively for online bookings and are not available to walk-in guests.",
  "Other cottages remain available for walk-in guests, so accommodations are still accessible without a prior reservation.",
  "A reservation/service fee applies to online bookings as part of the reservation process.",
  "Premium booking lets guests choose a preferred cottage. Standard bookings are assigned an available cottage at random.",
];

export function ReservationPolicies() {
  return (
    <aside className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm" aria-labelledby="reservation-policies-title">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Please review before booking</p>
      <h2 id="reservation-policies-title" className="mt-2 text-xl font-bold text-slate-950">
        Reservation Policies
      </h2>
      <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
        {reservationPolicies.map((policy, index) => (
          <li key={policy} className="grid grid-cols-[1.75rem_1fr] gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 font-bold text-amber-950">
              {index + 1}
            </span>
            <span>{policy}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

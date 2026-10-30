"use client";

import { AlarmClock, IdCard, Minus, Plus, Shuffle, Star } from "lucide-react";
import {
  formatPeso,
  getEntranceRates,
  partySize,
  type BookingCharges,
  type BookingSettings,
  type BookingType,
  type GuestParty,
} from "@/lib/booking-settings";
import type { GuestBookingView } from "./payment-panel";

/** Standard (resort assigns the cottage) or Premium (guest picks it, extra fee). */
export function BookingTypeChooser({
  value,
  onChange,
  premiumFee,
  compact = false,
}: {
  value: BookingType;
  onChange: (value: BookingType) => void;
  /** Premium fee to show; may differ per cottage, so callers pass the one that applies. */
  premiumFee: number;
  compact?: boolean;
}) {
  const options: Array<{ id: BookingType; title: string; detail: string; badge: string }> = [
    {
      id: "standard",
      title: "Standard booking",
      detail: "Pick a category and date. The resort assigns any available cottage.",
      badge: "No extra fee",
    },
    {
      id: "premium",
      title: "Premium booking",
      detail: "Choose your exact preferred cottage.",
      badge: premiumFee > 0 ? `+${formatPeso(premiumFee)}` : "Choose your cottage",
    },
  ];

  return (
    <div role="radiogroup" aria-label="Booking type" className={`grid gap-2 sm:grid-cols-2 ${compact ? "" : "sm:gap-3"}`}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`rounded-xl border-2 text-left transition ${compact ? "px-3 py-2" : "p-4"} ${
              selected
                ? option.id === "premium"
                  ? "border-amber-500 bg-amber-50 shadow-md"
                  : "border-bolihon-green bg-emerald-50 shadow-md"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? "border-slate-900" : "border-slate-300"}`}
                >
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-slate-900" /> : null}
                </span>
                <span className={`inline-flex items-center gap-1.5 ${compact ? "text-sm" : "text-base"} font-black text-slate-950`}>
                  {option.id === "premium" ? (
                    <Star aria-hidden="true" className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0`} />
                  ) : (
                    <Shuffle aria-hidden="true" className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0`} />
                  )}
                  {option.title}
                </span>
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  option.id === "premium" ? "bg-amber-200 text-amber-950" : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {option.badge}
              </span>
            </span>
            <span className={`mt-1 block pl-7 ${compact ? "text-xs" : "text-sm"} text-slate-600`}>{option.detail}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Optional internet access add-on. Hidden until the admin sets a fee. */
export function InternetAccessOption({
  settings,
  checked,
  onChange,
  id,
}: {
  settings: BookingSettings;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  if (settings.internetFeeAmount <= 0) return null;

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${checked ? "border-cyan-600 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
    >
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-cyan-700" />
      <span className="flex-1">
        <span className="block text-sm font-black text-slate-950">Add internet access (Wi-Fi)</span>
        <span className="block text-xs text-slate-600">Optional add-on for this booking</span>
      </span>
      <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-900">+{formatPeso(settings.internetFeeAmount)}</span>
    </label>
  );
}

/** Itemised charges with the total, used in both booking forms. */
export function ChargeBreakdown({ charges, days }: { charges: BookingCharges; days: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex justify-between gap-4">
        <span>Cottage fee{days > 1 ? ` (${days} days)` : ""}</span>
        <strong>{formatPeso(charges.cottageFee)}</strong>
      </div>
      {charges.reservationFee > 0 ? (
        <div className="mt-2 flex justify-between gap-4"><span>Reservation fee (online booking)</span><strong>{formatPeso(charges.reservationFee)}</strong></div>
      ) : null}
      {charges.premiumFee > 0 ? (
        <div className="mt-2 flex justify-between gap-4"><span>Premium booking (chosen cottage)</span><strong>{formatPeso(charges.premiumFee)}</strong></div>
      ) : null}
      {charges.entranceFee > 0 ? (
        <div className="mt-2 flex justify-between gap-4">
          <span>
            Entrance fee
            {charges.entranceParty && charges.entranceRates ? (
              <span className="block text-xs text-slate-500">{describeEntrance(charges.entranceParty, charges.entranceRates)}</span>
            ) : null}
          </span>
          <strong>{formatPeso(charges.entranceFee)}</strong>
        </div>
      ) : null}
      {charges.internetFee > 0 ? (
        <div className="mt-2 flex justify-between gap-4"><span>Internet access</span><strong>{formatPeso(charges.internetFee)}</strong></div>
      ) : null}
      <div className="mt-3 flex justify-between gap-4 border-t border-slate-300 pt-3 text-base">
        <strong>Total</strong>
        <strong>{formatPeso(charges.total)}</strong>
      </div>
    </div>
  );
}

/** Bold reminder shown on the booking form before the guest submits. */
export function PayBeforeNotice({ holdHours }: { holdHours: number }) {
  return (
    <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-black">
        <AlarmClock aria-hidden="true" className="h-4 w-4 shrink-0" />
        Pay online within {holdHours} hours of booking
      </p>
      <p className="mt-1">
        Next you&apos;ll see where to pay and a box for your payment reference number. Unpaid reservations are cancelled
        automatically when the deadline passes.
      </p>
    </div>
  );
}

/** Turns the POST /api/bookings response into the payment panel's booking view. */
export function guestViewFromNewBooking(
  result: {
    bookingNumber?: string;
    roomName?: string;
    bookingType?: BookingType;
    channel?: "online" | "walk_in";
    charges?: BookingCharges;
    paymentDeadline?: string;
    paymentInstructions?: string;
    booking?: Record<string, unknown>;
  },
  fallback: { checkIn: string; checkOut: string; guests: number; guestName: string },
): GuestBookingView {
  const row = result.booking || {};
  return {
    bookingNumber: String(result.bookingNumber || row.booking_number || row.id || ""),
    roomName: String(result.roomName || "Cottage"),
    guestName: fallback.guestName,
    checkIn: String(row.check_in || fallback.checkIn),
    checkOut: String(row.check_out || fallback.checkOut),
    guests: fallback.guests,
    status: String(row.status || "pending"),
    paymentStatus: String(row.payment_status || "unpaid"),
    totalPrice: result.charges?.total ?? Number(row.total_amount || 0),
    paymentInstructions: result.paymentInstructions || "",
    paymentDeadline: result.paymentDeadline,
    bookingType: result.bookingType,
    channel: result.channel,
    cottageSubtotal: result.charges?.cottageFee,
    reservationFeeAmount: result.charges?.reservationFee,
    premiumFeeAmount: result.charges?.premiumFee,
    internetFeeAmount: result.charges?.internetFee,
    entranceFeeAmount: result.charges?.entranceFee,
  };
}

/**
 * Guest count. With an entrance fee set, guests are split into regular,
 * children and senior citizen / PWD so each pays their own rate.
 */
export function PartyFields({
  id,
  settings,
  party,
  maxGuests,
  onChange,
}: {
  id: string;
  settings: BookingSettings;
  party: GuestParty;
  maxGuests: number;
  onChange: (party: GuestParty) => void;
}) {
  const total = partySize(party);
  const tooMany = total > maxGuests;

  if (settings.entranceFeeAmount <= 0) {
    return (
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          Guests
        </label>
        <input
          id={id}
          type="number"
          min={1}
          max={maxGuests}
          value={total}
          onChange={(event) => onChange({ regular: Math.max(0, Number(event.target.value) || 0), child: 0, senior: 0 })}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
        />
        <p className={`mt-2 text-sm ${tooMany ? "text-rose-700" : "text-slate-500"}`}>Max {maxGuests} guests.</p>
      </div>
    );
  }

  const rates = getEntranceRates(settings);
  const rows: Array<{ key: keyof GuestParty; label: string; hint: string; rate: number }> = [
    { key: "regular", label: "Regular", hint: "Adults", rate: rates.regular },
    { key: "child", label: "Children", hint: "Discounted rate", rate: rates.child },
    { key: "senior", label: "Senior citizen / PWD", hint: "Valid ID required at the gate", rate: rates.senior },
  ];

  function change(key: keyof GuestParty, delta: number) {
    const next = { ...party, [key]: Math.max(0, party[key] + delta) };
    if (partySize(next) >= 1) onChange(next);
  }

  return (
    <fieldset className="rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-700">Guests · entrance fee</legend>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{row.label}</span>
              <span className="block text-xs text-slate-500">
                {row.rate > 0 ? `${formatPeso(row.rate)} each` : "Free"} · {row.hint}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => change(row.key, -1)}
                disabled={party[row.key] === 0 || total <= 1}
                aria-label={`Fewer ${row.label.toLowerCase()} guests`}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus aria-hidden="true" className="h-4 w-4" />
              </button>
              <output id={`${id}-${row.key}`} aria-live="polite" className="w-8 text-center text-base font-bold tabular-nums text-slate-950">
                {party[row.key]}
              </output>
              <button
                type="button"
                onClick={() => change(row.key, 1)}
                disabled={total >= maxGuests}
                aria-label={`More ${row.label.toLowerCase()} guests`}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </span>
          </div>
        ))}
      </div>
      <p className={`mt-3 border-t border-slate-100 pt-2 text-sm ${tooMany ? "font-semibold text-rose-700" : "text-slate-600"}`}>
        {total} guest{total === 1 ? "" : "s"} · max {maxGuests}
      </p>
      {settings.entranceFeeNote ? (
        <p className="mt-1 inline-flex gap-1.5 text-xs text-slate-500">
          <IdCard aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {settings.entranceFeeNote}
        </p>
      ) : null}
    </fieldset>
  );
}

/** "2 regular × Php50 · 1 child × Php30 · 1 senior/PWD × Php40" (groups with nobody are left out). */
export function describeEntrance(party: GuestParty, rates: { regular: number; child: number; senior: number }) {
  return [
    party.regular ? `${party.regular} regular × ${formatPeso(rates.regular)}` : "",
    party.child ? `${party.child} child${party.child === 1 ? "" : "ren"} × ${formatPeso(rates.child)}` : "",
    party.senior ? `${party.senior} senior/PWD × ${formatPeso(rates.senior)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

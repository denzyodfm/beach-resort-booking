import type { PaymentStatus, Room } from "./types";

/**
 * Resort-wide online booking rules, stored in resort_settings and edited in
 * Admin → Users & settings. Shared by the booking screens and the bookings API
 * so the price a guest sees is the price the server charges.
 */
export type BookingSettings = {
  /** Charged once on every online booking. A cottage's own reservation fee overrides it. */
  reservationFeeAmount: number;
  /** Charged once when the guest picks their exact cottage. A cottage's own premium charge overrides it. */
  premiumFeeAmount: number;
  /** Optional internet access add-on, once per booking. 0 hides the option. */
  internetFeeAmount: number;
  /** Regular per-person admission to the resort grounds, once per booking (walk-in and online). 0 turns entrance fees off. */
  entranceFeeAmount: number;
  /** Children's rate. null = same as the regular rate; 0 = free. */
  entranceFeeChildAmount: number | null;
  /** Senior citizen / PWD rate. null = same as the regular rate; 0 = free. */
  entranceFeeSeniorAmount: number | null;
  /** Rules shown with the rates, e.g. age limits and ID requirements. */
  entranceFeeNote: string;
  /** Where to send online payments, shown on the payment screen. */
  paymentInstructions: string;
};

/** standard = the resort assigns any free cottage in the category; premium = the guest picks the cottage. */
export type BookingType = "standard" | "premium";
export type BookingChannel = "online" | "walk_in";

export const defaultBookingSettings: BookingSettings = {
  reservationFeeAmount: 0,
  premiumFeeAmount: 0,
  internetFeeAmount: 0,
  entranceFeeAmount: 0,
  entranceFeeChildAmount: null,
  entranceFeeSeniorAmount: null,
  entranceFeeNote: "",
  paymentInstructions: "",
};

export const resortTimeZone = "Asia/Manila";

export function normalizeBookingSettings(row: Record<string, unknown> | null | undefined): BookingSettings {
  const source = row || {};
  const amount = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
  };

  // Blank means "same as regular", so it must stay distinct from 0 ("free").
  const optionalAmount = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
  };

  return {
    reservationFeeAmount: amount(source.reservationFeeAmount ?? source.reservation_fee_amount),
    premiumFeeAmount: amount(source.premiumFeeAmount ?? source.premium_fee_amount),
    internetFeeAmount: amount(source.internetFeeAmount ?? source.internet_fee_amount),
    entranceFeeAmount: amount(source.entranceFeeAmount ?? source.entrance_fee_amount),
    entranceFeeChildAmount: optionalAmount(source.entranceFeeChildAmount ?? source.entrance_fee_child_amount),
    entranceFeeSeniorAmount: optionalAmount(source.entranceFeeSeniorAmount ?? source.entrance_fee_senior_amount),
    entranceFeeNote: String(source.entranceFeeNote ?? source.entrance_fee_note ?? "").trim(),
    paymentInstructions: String(source.paymentInstructions ?? source.payment_instructions ?? "").trim(),
  };
}

/** Who is in the party, for the entrance fee. regular + child + senior = total guests. */
export type GuestParty = { regular: number; child: number; senior: number };

export function partySize(party: GuestParty) {
  return party.regular + party.child + party.senior;
}

/** Reads a party from a request or saved booking. Without one, every guest is regular. */
export function normalizeParty(value: unknown, fallbackGuests = 1): GuestParty {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const count = (raw: unknown) => Math.max(0, Math.floor(Number(raw)) || 0);
  const party = { regular: count(source.regular), child: count(source.child), senior: count(source.senior) };
  return partySize(party) > 0 ? party : { regular: Math.max(1, Math.floor(fallbackGuests) || 1), child: 0, senior: 0 };
}

export type EntranceRates = { regular: number; child: number; senior: number };

export function getEntranceRates(settings: BookingSettings): EntranceRates {
  return {
    regular: settings.entranceFeeAmount,
    child: settings.entranceFeeChildAmount ?? settings.entranceFeeAmount,
    senior: settings.entranceFeeSeniorAmount ?? settings.entranceFeeAmount,
  };
}

export function getBookingChannel(room: Pick<Room, "onlineReservable">): BookingChannel {
  return room.onlineReservable === false ? "walk_in" : "online";
}

/** The payment hold most online cottages use, for the rules banner. Cottages can differ. */
export function typicalHoldHours(rooms: Room[]) {
  const counts = new Map<number, number>();
  for (const room of rooms) {
    const hours = room.reservationHoldHours || 24;
    counts.set(hours, (counts.get(hours) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 24;
}

export function getReservationFee(room: Room, settings: BookingSettings) {
  if (getBookingChannel(room) === "walk_in") return 0;
  return room.reservationFeeEnabled && room.reservationFeeAmount ? room.reservationFeeAmount : settings.reservationFeeAmount;
}

export function getPremiumFee(room: Room, settings: BookingSettings) {
  if (getBookingChannel(room) === "walk_in") return 0;
  return room.premiumFeeEnabled && room.premiumFeeAmount ? room.premiumFeeAmount : settings.premiumFeeAmount;
}

export type BookingCharges = {
  cottageFee: number;
  reservationFee: number;
  premiumFee: number;
  internetFee: number;
  /** Entrance fee for the whole party (each guest × their rate). */
  entranceFee: number;
  /** Party and rates the entrance fee was worked out from, kept for the invoice. */
  entranceParty?: GuestParty;
  entranceRates?: EntranceRates;
  total: number;
};

export function getBookingCharges({
  room,
  days,
  settings,
  bookingType,
  internetAccess,
  party,
}: {
  room: Room;
  days: number;
  settings: BookingSettings;
  bookingType: BookingType;
  internetAccess: boolean;
  party: GuestParty;
}): BookingCharges {
  const cottageFee = room.pricePerNight * days;
  const reservationFee = getReservationFee(room, settings);
  const premiumFee = bookingType === "premium" ? getPremiumFee(room, settings) : 0;
  const internetFee = internetAccess ? settings.internetFeeAmount : 0;
  const rates = getEntranceRates(settings);
  const entranceFee =
    settings.entranceFeeAmount > 0
      ? party.regular * rates.regular + party.child * rates.child + party.senior * rates.senior
      : 0;

  return {
    cottageFee,
    reservationFee,
    premiumFee,
    internetFee,
    entranceFee,
    ...(entranceFee > 0 ? { entranceParty: party, entranceRates: rates } : {}),
    total: cottageFee + reservationFee + premiumFee + internetFee + entranceFee,
  };
}

export function formatPeso(value: number | undefined) {
  return `Php${(Number.isFinite(value) ? value || 0 : 0).toLocaleString()}`;
}

/** "Thu, Oct 23, 3:15 PM" in resort time. */
export function formatDeadline(iso: string | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: resortTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "5h 12m left", "12m left" or "Deadline passed". */
export function formatTimeLeft(iso: string | undefined, now = Date.now()) {
  if (!iso) return "";
  const remaining = new Date(iso).getTime() - now;
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Deadline passed";
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export function bookingStatusLabel(status: string) {
  return status === "checked_in" ? "Checked in" : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

export function paymentStatusLabel(status: PaymentStatus | string) {
  switch (status) {
    case "unpaid":
      return "Unpaid";
    case "authorized":
      return "Reference submitted";
    case "deposit_paid":
      return "Deposit paid";
    case "paid":
      return "Paid";
    case "refunded":
      return "Refunded";
    default:
      return String(status).replace(/_/g, " ");
  }
}

/** GCash and bank references: letters, digits and dashes, spaces removed. */
export function normalizePaymentReference(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function isValidPaymentReference(reference: string) {
  return /^[A-Z0-9-]{6,40}$/.test(reference);
}

/** Compares cellphone numbers by their last 10 digits, so +63 917… matches 0917…. */
export function samePhoneNumber(first: unknown, second: unknown) {
  const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-10);
  const a = digits(first);
  return a.length >= 7 && a === digits(second);
}

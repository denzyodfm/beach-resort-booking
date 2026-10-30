import { normalizeParty } from "./booking-settings";
import type { Booking } from "./types";

/**
 * Online-booking fields of a booking row: the payment deadline and reference
 * columns, plus the booking type, channel and fee breakdown saved in the
 * special_requests JSON when the booking was made.
 */
export function readBookingExtras(source: Record<string, unknown>): Pick<
  Booking,
  | "bookingNumber"
  | "invoiceNumber"
  | "checkedInAt"
  | "paymentDeadline"
  | "paymentReference"
  | "bookingType"
  | "channel"
  | "cottageSubtotal"
  | "reservationFeeAmount"
  | "premiumFeeAmount"
  | "internetFeeAmount"
  | "entranceFeeAmount"
  | "party"
  | "entranceRates"
> {
  let details: Record<string, unknown> = {};
  const raw = source.special_requests ?? source.specialRequests;
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") details = parsed as Record<string, unknown>;
    } catch {
      details = {};
    }
  }
  const charges = (details.charges || {}) as Record<string, unknown>;
  const number = (value: unknown) => (value === undefined || value === null ? undefined : Number(value) || 0);

  return {
    bookingNumber: String(source.bookingNumber || source.booking_number || "") || undefined,
    invoiceNumber: String(source.invoiceNumber || source.invoice_number || "") || undefined,
    checkedInAt: String(source.checkedInAt || source.checked_in_at || "") || undefined,
    paymentDeadline: String(source.paymentDeadline || source.payment_deadline || "") || undefined,
    paymentReference: String(source.paymentReference || source.payment_reference || "") || undefined,
    bookingType: (source.bookingType || details.bookingType) === "premium"
      ? "premium"
      : (source.bookingType || details.bookingType) === "standard" ? "standard" : undefined,
    channel: (source.channel || details.channel) === "walk_in"
      ? "walk_in"
      : (source.channel || details.channel) === "online" ? "online" : undefined,
    cottageSubtotal: number(source.cottageSubtotal ?? charges.cottageFee ?? source.subtotal_amount),
    reservationFeeAmount: number(source.reservationFeeAmount ?? charges.reservationFee),
    premiumFeeAmount: number(source.premiumFeeAmount ?? charges.premiumFee),
    internetFeeAmount: number(source.internetFeeAmount ?? charges.internetFee),
    entranceFeeAmount: number(source.entranceFeeAmount ?? charges.entranceFee),
    party: details.party || charges.entranceParty
      ? normalizeParty(details.party || charges.entranceParty, Number(source.guest_count || source.guests || 1))
      : undefined,
    entranceRates: charges.entranceRates as Booking["entranceRates"],
  };
}

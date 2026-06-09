import type { Booking, PaymentStatus } from "./types";
import { nightsBetween } from "./resort-data";

export const cancellationWindowDays = 7;
export const activeBookingStatuses = ["pending", "confirmed"] as const;

export function dateRangesOverlap(
  firstCheckIn: string,
  firstCheckOut: string,
  secondCheckIn: string,
  secondCheckOut: string,
) {
  return firstCheckIn <= secondCheckOut && firstCheckOut >= secondCheckIn;
}

export function findBookingConflict(
  bookings: Booking[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  ignoredBookingId?: string,
) {
  return bookings.find(
    (booking) =>
      booking.id !== ignoredBookingId &&
      booking.roomId === roomId &&
      activeBookingStatuses.includes(booking.status as (typeof activeBookingStatuses)[number]) &&
      dateRangesOverlap(booking.checkIn, booking.checkOut, checkIn, checkOut),
  );
}

export function getUnavailableRanges(bookings: Booking[], roomId: string) {
  return bookings
    .filter(
      (booking) =>
        booking.roomId === roomId &&
        activeBookingStatuses.includes(booking.status as (typeof activeBookingStatuses)[number]),
    )
    .map((booking) => ({
      bookingId: booking.id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      label: `${booking.checkIn} to ${booking.checkOut}`,
    }))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

export function calculateTotal(pricePerNight: number, checkIn: string, checkOut: string) {
  const nights = nightsBetween(checkIn, checkOut);
  return {
    nights,
    subtotal: pricePerNight * nights,
    total: pricePerNight * nights,
  };
}

export function isPaidEnoughToConfirm(paymentStatus: PaymentStatus) {
  return paymentStatus === "paid" || paymentStatus === "deposit_paid";
}

export function canGuestCancel(checkIn: string, now = new Date()) {
  const checkInDate = new Date(`${checkIn}T00:00:00`);
  const cancelBy = new Date(checkInDate);
  cancelBy.setDate(cancelBy.getDate() - cancellationWindowDays);

  return {
    allowed: now <= cancelBy,
    cancelBy: cancelBy.toISOString().slice(0, 10),
  };
}

export function buildBookingConfirmationMessage(booking: {
  id?: string;
  roomName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
}) {
  const contact = booking.guestEmail || booking.guestPhone || "guest contact";

  return `Booking recorded for ${contact}: ${booking.guestName}, your pending booking${booking.id ? ` ${booking.id}` : ""} for ${booking.roomName} from ${booking.checkIn} to ${booking.checkOut} is reserved pending payment. Total: Php${booking.totalPrice.toLocaleString()}.`;
}

"use client";

import { sampleBookings } from "@/lib/resort-data";
import type { Booking } from "@/lib/types";

const storageKey = "bolihon-demo-bookings-v2";

export function getDemoBookings() {
  if (typeof window === "undefined") return sampleBookings;

  try {
    const stored = window.localStorage.getItem(storageKey);
    const localBookings = stored ? (JSON.parse(stored) as Booking[]) : [];
    const sampleIds = new Set(sampleBookings.map((booking) => booking.id));
    const uniqueLocal = localBookings.filter((booking) => !sampleIds.has(booking.id));

    return [...uniqueLocal, ...sampleBookings];
  } catch {
    return sampleBookings;
  }
}

export function saveDemoBooking(booking: Booking) {
  if (typeof window === "undefined") return;

  const current = getDemoBookings().filter((item) => item.id !== booking.id);
  const localOnly = [booking, ...current].filter(
    (item) => !sampleBookings.some((sample) => sample.id === item.id),
  );

  window.localStorage.setItem(storageKey, JSON.stringify(localOnly));
  window.dispatchEvent(new Event("bolihon-bookings-updated"));
}

export function updateDemoBooking(id: string, updates: Partial<Booking>) {
  if (typeof window === "undefined") return;

  const next = getDemoBookings().map((booking) =>
    booking.id === id ? { ...booking, ...updates } : booking,
  );
  const localOnly = next.filter((item) => !sampleBookings.some((sample) => sample.id === item.id));

  window.localStorage.setItem(storageKey, JSON.stringify(localOnly));
  window.dispatchEvent(new Event("bolihon-bookings-updated"));
}

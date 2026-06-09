import { sampleBookings } from "@/lib/resort-data";
import type { Booking } from "@/lib/types";

const globalStore = globalThis as typeof globalThis & {
  __bolihonDemoBookings?: Booking[];
};

function getStore() {
  if (!globalStore.__bolihonDemoBookings) {
    globalStore.__bolihonDemoBookings = [];
  }

  return globalStore.__bolihonDemoBookings;
}

export function getServerDemoBookings() {
  const sampleIds = new Set(sampleBookings.map((booking) => booking.id));
  const uniqueRuntimeBookings = getStore().filter((booking) => !sampleIds.has(booking.id));

  return [...uniqueRuntimeBookings, ...sampleBookings];
}

export function addServerDemoBooking(booking: Booking) {
  const store = getStore();
  const next = [booking, ...store.filter((item) => item.id !== booking.id)];
  globalStore.__bolihonDemoBookings = next;

  return booking;
}

export function updateServerDemoBooking(id: string, updates: Partial<Booking>) {
  const current = getServerDemoBookings();
  const existing = current.find((booking) => booking.id === id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const sampleIds = new Set(sampleBookings.map((booking) => booking.id));
  globalStore.__bolihonDemoBookings = current
    .map((booking) => (booking.id === id ? updated : booking))
    .filter((booking) => !sampleIds.has(booking.id));

  return updated;
}

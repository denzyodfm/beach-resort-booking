import type { BookingBlockedDate } from "@/lib/booking-blocked-dates";

const globalStore = globalThis as typeof globalThis & {
  __bolihonBlockedDates?: BookingBlockedDate[];
};

function getStore() {
  if (!globalStore.__bolihonBlockedDates) {
    globalStore.__bolihonBlockedDates = [];
  }

  return globalStore.__bolihonBlockedDates;
}

export function getServerBlockedDates() {
  return getStore().slice().sort((a, b) => a.date.localeCompare(b.date));
}

export function addServerBlockedDate(date: BookingBlockedDate) {
  const store = getStore();
  globalStore.__bolihonBlockedDates = [date, ...store.filter((item) => item.date !== date.date)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return date;
}

export function deleteServerBlockedDate(id: string) {
  const store = getStore();
  const existing = store.find((item) => item.id === id || item.date === id);
  globalStore.__bolihonBlockedDates = store.filter((item) => item.id !== id && item.date !== id);
  return existing || null;
}

export type BookingBlockedDate = {
  id: string;
  date: string;
  label: string;
  createdAt?: string;
};

export type BlockedDateCheck = {
  blocked: boolean;
  reason: string;
  date?: string;
};

export function normalizeBlockedDate(row: BookingBlockedDate | Record<string, unknown>): BookingBlockedDate {
  const source = row as Record<string, unknown>;
  const date = String(source.date || source.blocked_date || "");
  const label = String(source.label || source.name || source.reason || "Philippine holiday");

  return {
    id: String(source.id || date),
    date,
    label,
    createdAt: String(source.createdAt || source.created_at || ""),
  };
}

export function isWeekendDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const day = parsed.getDay();
  return day === 0 || day === 6;
}

export function getWeekendLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getDay() === 6 ? "Saturday" : "Sunday";
}

export function getDatesInRange(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function findBlockedBookingDate(checkIn: string, checkOut: string, blockedDates: BookingBlockedDate[]): BlockedDateCheck {
  const holidayByDate = new Map(blockedDates.map((date) => [date.date, date]));

  for (const date of getDatesInRange(checkIn, checkOut)) {
    if (isWeekendDate(date)) {
      return {
        blocked: true,
        date,
        reason: `${date} falls on a ${getWeekendLabel(date)}. Weekend bookings are not allowed.`,
      };
    }

    const holiday = holidayByDate.get(date);
    if (holiday) {
      return {
        blocked: true,
        date,
        reason: `${date} is blocked for ${holiday.label}.`,
      };
    }
  }

  return { blocked: false, reason: "" };
}

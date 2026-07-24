"use client";

import { useEffect, useMemo, useState } from "react";
import { findBlockedBookingDate, type BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { findBookingConflict, dateRangesOverlap } from "@/lib/booking-logic";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";
import { getDemoBookings, saveDemoBooking } from "@/lib/demo-bookings";
import { nightsBetween } from "@/lib/resort-data";
import { hasSupabaseEnv } from "@/lib/supabase-browser";
import type { Booking, BookingStatus, CottageCategory, PaymentStatus, Room } from "@/lib/types";

type BookingRow = Booking | Record<string, unknown>;
type FormState = {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guests: number;
};

const todayMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
const activeStatuses: BookingStatus[] = ["pending", "confirmed"];

function normalizeBooking(row: BookingRow): Booking {
  const source = row as Record<string, unknown>;
  const nestedRoom = source.rooms as { name?: string } | undefined;

  return {
    id: String(source.id || source.booking_number || ""),
    roomId: String(source.roomId || source.room_id || ""),
    roomName: String(source.roomName || nestedRoom?.name || "Cottage"),
    guestName: String(source.guestName || source.guest_name || ""),
    guestEmail: String(source.guestEmail || source.guest_email || ""),
    guestPhone: String(source.guestPhone || source.guest_phone || ""),
    checkIn: String(source.checkIn || source.check_in || ""),
    checkOut: String(source.checkOut || source.check_out || ""),
    guests: Number(source.guests || source.guest_count || 1),
    totalPrice: Number(source.totalPrice ?? source.total_amount ?? 0),
    status: (source.status || "pending") as BookingStatus,
    paymentStatus: (source.paymentStatus || source.payment_status || "unpaid") as PaymentStatus,
    createdAt: String(source.createdAt || source.created_at || new Date().toISOString()).slice(0, 10),
  };
}

function formatPeso(value: number) {
  return `Php${value.toLocaleString()}`;
}

export function DateCottageBooking({
  rooms,
  categories,
}: {
  rooms: Room[];
  categories: CottageCategory[];
}) {
  const { user } = useDemoAuth();
  const isManager = canManageResort(user?.role);
  const supabaseConfigured = hasSupabaseEnv();
  const categoryOptions = useMemo(
    () => categories.filter((category) => rooms.some((room) => room.categoryId === category.id)),
    [categories, rooms],
  );
  const [month, setMonth] = useState(todayMonth);
  const bookingDate = `${month}-01`;
  const [selectedDay, setSelectedDay] = useState<string>(bookingDate);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BookingBlockedDate[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [form, setForm] = useState<FormState>({
    guestName: user?.name || "",
    guestPhone: user?.phone || "",
    guestEmail: user?.email || "",
    guests: 2,
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    function mergeBookings(apiRows: BookingRow[]) {
      const apiBookings = apiRows.map(normalizeBooking);
      if (supabaseConfigured) return apiBookings;

      const localBookings = getDemoBookings().map(normalizeBooking);
      const apiIds = new Set(apiBookings.map((booking) => booking.id));
      return [...apiBookings, ...localBookings.filter((booking) => !apiIds.has(booking.id))];
    }

    const syncBookings = () => {
      if (!supabaseConfigured) {
        setBookings(getDemoBookings().map(normalizeBooking));
      }

      fetch(isManager ? "/api/admin/bookings" : "/api/bookings")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((rows: BookingRow[]) => {
          if (active) setBookings(mergeBookings(rows));
        })
        .catch(() => {
          if (active) setBookings(getDemoBookings().map(normalizeBooking));
        });
    };

    syncBookings();
    window.addEventListener("bolihon-bookings-updated", syncBookings);

    return () => {
      active = false;
      window.removeEventListener("bolihon-bookings-updated", syncBookings);
    };
  }, [isManager, supabaseConfigured]);

  useEffect(() => {
    let active = true;

    fetch("/api/booking-blocked-dates")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((dates: BookingBlockedDate[]) => {
        if (active) setBlockedDates(dates);
      })
      .catch(() => {
        if (active) setBlockedDates([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const effectiveDay = selectedDay || bookingDate;
  const total = selectedRoom ? selectedRoom.pricePerNight * nightsBetween(effectiveDay, effectiveDay) : 0;
  const blockedDate = findBlockedBookingDate(effectiveDay, effectiveDay, blockedDates);
  const selectedCategory = categoryOptions.find((category) => category.id === selectedCategoryId) || categoryOptions[0];
  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.categoryId === selectedCategory?.id),
    [rooms, selectedCategory?.id],
  );

  const activeBookings = useMemo(
    () => bookings.filter((booking) => activeStatuses.includes(booking.status)),
    [bookings],
  );

  function getDateBooking(roomId: string, day = effectiveDay) {
    return findBookingConflict(activeBookings, roomId, day, day);
  }

  function monthRangeFromMonthString(monthStr: string) {
    const [y, m] = monthStr.split("-");
    const start = `${y}-${m}-01`;
    const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
    return { start, end };
  }

  function getMonthDays(monthStr: string) {
    const [y, m] = monthStr.split("-");
    const year = Number(y);
    const monthIndex = Number(m) - 1;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const mm = String(monthIndex + 1).padStart(2, "0");
      return `${y}-${mm}-${String(d).padStart(2, "0")}`;
    });
  }

  const monthDays = useMemo(() => getMonthDays(month), [month]);
  const weekdayLabels = useMemo(
    () => monthDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(day).getDay()]),
    [monthDays],
  );
  const calendarGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `minmax(180px, 1.6fr) repeat(${monthDays.length}, minmax(24px, 1fr))`,
    }),
    [monthDays],
  );

  function selectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setMessage("");
    setSelectedRoomId((currentRoomId) => {
      const currentRoom = rooms.find((room) => room.id === currentRoomId);
      return currentRoom?.categoryId === categoryId ? currentRoomId : "";
    });
  }

  function selectCell(room: Room, day: string) {
    const blocked = findBlockedBookingDate(day, day, blockedDates);
    if (blocked.blocked) {
      setMessage(blocked.reason);
      return;
    }

    const conflict = getDateBooking(room.id, day);
    if (room.available === false || conflict) return;

    setSelectedDay(day);
    setSelectedRoomId(room.id);
    setMessage("");
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) return;

    if (blockedDate.blocked) {
      setMessage(blockedDate.reason);
      return;
    }

    const conflict = getDateBooking(selectedRoom.id);
    if (conflict) {
      setMessage(`${selectedRoom.name} is already booked on ${effectiveDay}.`);
      return;
    }

    if (!form.guestPhone.trim()) {
      setMessage("Cellphone number is required for booking confirmation.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const payload = {
      roomId: selectedRoom.id,
      guestName: form.guestName,
      guestEmail: form.guestEmail,
      guestPhone: form.guestPhone,
      checkIn: effectiveDay,
      checkOut: effectiveDay,
      guests: form.guests,
      totalPrice: total,
    };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        booking?: Booking | Record<string, unknown>;
        message?: string;
      };

      if (!response.ok && supabaseConfigured) {
        throw new Error(result.message || "Unable to save booking.");
      }

      if (!supabaseConfigured) {
        const source = (result.booking || {}) as Record<string, unknown>;
        saveDemoBooking({
          id: String(source.id || source.booking_number || `DEMO-${Date.now()}`),
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone,
          checkIn: effectiveDay,
          checkOut: effectiveDay,
          guests: form.guests,
          totalPrice: total,
          status: "pending",
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }

      setMessage(result.message || `${selectedRoom.name} is held as a pending booking for ${effectiveDay}.`);
      setSelectedRoomId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-1">
      <div className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="booking-month" className="text-sm font-semibold text-slate-700">
            Booking month
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="booking-month"
              type="month"
              min={todayMonth}
              value={month}
              onChange={(event) => {
                const newMonth = event.target.value;
                setMonth(newMonth);
                setSelectedDay(`${newMonth}-01`);
                setSelectedRoomId("");
                setMessage("");
              }}
              className="min-h-12 rounded-md border border-slate-300 px-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
            />
            <p className="text-sm text-slate-500">
              {(() => {
                const { start, end } = monthRangeFromMonthString(month);
                return activeBookings.filter((booking) => dateRangesOverlap(booking.checkIn, booking.checkOut, start, end)).length;
              })()}{" "}cottage booking(s) found for this month.
            </p>
          </div>
          {blockedDate.blocked ? (
            <p className="mt-3 rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {blockedDate.reason}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Category</p>
          <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {categoryOptions.map((category) => {
              const categoryRoomCount = rooms.filter((room) => room.categoryId === category.id).length;
              const selected = selectedCategory?.id === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={`h-full w-full rounded-lg border px-4 py-4 text-left transition ${
                    selected
                      ? "border-bolihon-green bg-bolihon-green text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-bolihon-green hover:text-bolihon-green"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold leading-tight">{category.name}</span>
                    <span className={`text-xs font-semibold ${selected ? "text-white/80" : "text-slate-500"}`}>
                      {categoryRoomCount}
                    </span>
                  </div>
                  <span className={`mt-3 block text-xs ${selected ? "text-white/80" : "text-slate-500"}`}>
                    {categoryRoomCount} cottage{categoryRoomCount === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedCategory ? (
          <section className="grid gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">{selectedCategory.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedCategory.description}</p>
            </div>

            <div className="overflow-auto rounded border bg-white">
              <div className="min-w-[1050px] w-full">
                {/* Header: days */}
                <div className="sticky top-0 z-10 bg-white/95 px-2 py-3">
                  <div className="grid items-center gap-1" style={calendarGridStyle}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 text-xs font-semibold">
                      <span>Cottage</span>
                      <span>Rate</span>
                    </div>
                    {monthDays.map((day) => (
                      <div key={`${day}-number`} className="text-xs text-center text-slate-600" title={day}>
                        {new Date(day).getDate()}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid items-center gap-1" style={calendarGridStyle}>
                    <div className="px-3 text-xs font-semibold text-slate-500">Day</div>
                    {weekdayLabels.map((label, index) => (
                      <div
                        key={`${monthDays[index]}-weekday`}
                        className={`text-[10px] text-center font-semibold ${label === "Sat" || label === "Sun" ? "text-rose-600" : "text-slate-500"}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows: cottages */}
                <div>
                  {visibleRooms.map((room) => (
                    <div key={room.id} className="grid items-center gap-1 border-t px-2 py-2" style={calendarGridStyle}>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3">
                        <div className="text-sm font-semibold leading-snug text-slate-900">{room.name}</div>
                        <div className="whitespace-nowrap text-xs font-medium text-slate-500">{formatPeso(room.pricePerNight)}</div>
                      </div>
                      {monthDays.map((day) => {
                        const blocked = findBlockedBookingDate(day, day, blockedDates);
                        const hasBooking = activeBookings.some((b) => b.roomId === room.id && dateRangesOverlap(b.checkIn, b.checkOut, day, day));
                        const disabled = room.available === false || hasBooking || blocked.blocked;

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={disabled}
                            onClick={() => selectCell(room, day)}
                            className={`h-7 w-full min-w-6 rounded-sm border flex items-center justify-center transition ${
                              disabled
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                            }`}
                            title={`${room.name} — ${day}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">Booking details</p>
                  {selectedRoom ? (
                    <p className="mt-2 text-sm text-slate-600">
                      Selected <span className="font-semibold text-slate-900">{selectedRoom.name}</span> on <span className="font-semibold text-slate-900">{effectiveDay}</span>.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      Click a green cell to choose an available cottage and date.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-sm bg-emerald-500 border border-emerald-500" />
                    Available
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-sm bg-slate-100 border border-slate-200" />
                    Booked / blocked
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-rose-600 font-semibold">Sat / Sun</span>
                    Weekend
                  </span>
                </div>
              </div>

              {selectedRoom ? (
                <form onSubmit={submitBooking} className="grid gap-4">
                  <Field label="Guest name" value={form.guestName} onChange={(guestName) => setForm((current) => ({ ...current, guestName }))} />
                  <Field label="Cellphone no." type="tel" value={form.guestPhone} onChange={(guestPhone) => setForm((current) => ({ ...current, guestPhone }))} />
                  <Field
                    label="Email (optional)"
                    type="email"
                    required={false}
                    value={form.guestEmail}
                    onChange={(guestEmail) => setForm((current) => ({ ...current, guestEmail }))}
                  />
                  <div>
                    <label htmlFor="date-guests" className="text-sm font-semibold text-slate-700">
                      Guests
                    </label>
                    <input
                      id="date-guests"
                      type="number"
                      min={1}
                      max={selectedRoom.maxGuests}
                      value={form.guests}
                      onChange={(event) => setForm((current) => ({ ...current, guests: Number(event.target.value) }))}
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || blockedDate.blocked || form.guests < 1 || form.guests > selectedRoom.maxGuests || !form.guestPhone.trim()}
                    className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {submitting ? "Holding..." : "Hold this cottage"}
                  </button>
                </form>
              ) : null}

              {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No cottage categories are available yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  required = true,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

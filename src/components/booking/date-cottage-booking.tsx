"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  resortToday,
  todayOnly = false,
  compact = false,
}: {
  rooms: Room[];
  categories: CottageCategory[];
  resortToday: string;
  todayOnly?: boolean;
  compact?: boolean;
}) {
  const today = resortToday;
  const todayMonth = today.slice(0, 7);
  const { user } = useDemoAuth();
  const isManager = canManageResort(user?.role);
  const supabaseConfigured = hasSupabaseEnv();
  const categoryOptions = useMemo(
    () => categories.filter((category) => rooms.some((room) => room.categoryId === category.id)),
    [categories, rooms],
  );
  const [month, setMonth] = useState(todayMonth);
  const bookingDate = month === todayMonth ? today : `${month}-01`;
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
  const bookingDialogRef = useRef<HTMLDialogElement>(null);

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
  const cottageFee = selectedRoom ? selectedRoom.pricePerNight * nightsBetween(effectiveDay, effectiveDay) : 0;
  const premiumFee = selectedRoom?.premiumFeeEnabled ? selectedRoom.premiumFeeAmount || 0 : 0;
  const reservationFee = selectedRoom?.reservationFeeEnabled ? selectedRoom.reservationFeeAmount || 0 : 0;
  const total = cottageFee + premiumFee + reservationFee;
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
  const monthBookings = useMemo(() => {
    const { start, end } = monthRangeFromMonthString(month);
    return activeBookings.filter((booking) =>
      dateRangesOverlap(booking.checkIn, booking.checkOut, start, end),
    );
  }, [activeBookings, month]);

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

  const monthDays = useMemo(() => (todayOnly ? [today] : getMonthDays(month)), [month, today, todayOnly]);
  const weekdayLabels = useMemo(
    () => monthDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(day).getDay()]),
    [monthDays],
  );
  const calendarGridStyle = useMemo(
    () => ({
      gridTemplateColumns: todayOnly
        ? "minmax(240px, 0.9fr) minmax(220px, 1.1fr)"
        : `minmax(180px, 1.6fr) repeat(${monthDays.length}, minmax(24px, 1fr))`,
    }),
    [monthDays, todayOnly],
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
    if (day < today) {
      setMessage("Past dates are not available for booking.");
      return;
    }

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
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        bookingDialogRef.current?.showModal();
        window.requestAnimationFrame(() => document.getElementById("dialog-guest-name")?.focus());
      } else {
        document.getElementById("mobile-guest-name")?.focus();
      }
    });
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
          id: String(source.id || source.booking_number || `DEMO-${window.crypto.randomUUID()}`),
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
      bookingDialogRef.current?.close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderBookingForm(prefix: string) {
    if (!selectedRoom) return null;

    return (
      <form onSubmit={submitBooking} className="grid gap-4">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          This cottage will be held for {selectedRoom.reservationHoldHours || 24} hours after booking. If payment is not recorded before the hold expires, the reservation is cancelled automatically and the cottage becomes available again.
        </p>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-4"><span>Cottage fee</span><strong>{formatPeso(cottageFee)}</strong></div>
          {premiumFee > 0 ? <div className="mt-2 flex justify-between gap-4"><span>Premium charge</span><strong>{formatPeso(premiumFee)}</strong></div> : null}
          {reservationFee > 0 ? <div className="mt-2 flex justify-between gap-4"><span>Reservation/service fee</span><strong>{formatPeso(reservationFee)}</strong></div> : null}
          <div className="mt-3 flex justify-between gap-4 border-t border-slate-300 pt-3 text-base"><strong>Total</strong><strong>{formatPeso(total)}</strong></div>
        </div>
        <Field
          id={`${prefix}-guest-name`}
          label="Guest name"
          value={form.guestName}
          onChange={(guestName) => setForm((current) => ({ ...current, guestName }))}
        />
        <Field
          id={`${prefix}-guest-phone`}
          label="Cellphone no."
          type="tel"
          value={form.guestPhone}
          onChange={(guestPhone) => setForm((current) => ({ ...current, guestPhone }))}
        />
        <Field
          id={`${prefix}-guest-email`}
          label="Email (optional)"
          type="email"
          required={false}
          value={form.guestEmail}
          onChange={(guestEmail) => setForm((current) => ({ ...current, guestEmail }))}
        />
        <div>
          <label htmlFor={`${prefix}-guests`} className="text-sm font-semibold text-slate-700">
            Guests
          </label>
          <input
            id={`${prefix}-guests`}
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
    );
  }

  return (
    <div className={`grid lg:grid-cols-1 ${compact ? "gap-2" : "gap-3"}`}>
      <div className={compact ? "grid gap-2" : "grid gap-3"}>
        {!todayOnly ? <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
          <label htmlFor="booking-month" className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-700`}>
            Booking month
          </label>
          <div className={`${compact ? "mt-1" : "mt-1.5"} flex flex-col gap-2 sm:flex-row sm:items-center`}>
            <input
              id="booking-month"
              type="month"
              min={todayMonth}
              value={month}
              onChange={(event) => {
                const newMonth = event.target.value;
                setMonth(newMonth);
                setSelectedDay(newMonth === todayMonth ? today : `${newMonth}-01`);
                setSelectedRoomId("");
                setMessage("");
              }}
              className={`${compact ? "min-h-8 text-sm" : "min-h-10"} rounded-md border border-slate-300 px-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2`}
            />
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">
                {monthBookings.length} cottage booking(s) found for this month.
              </p>
              {monthBookings.map((booking) => (
                <span
                  key={booking.id}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
                >
                  {booking.roomName} · {booking.checkIn}
                  {booking.checkOut !== booking.checkIn ? ` to ${booking.checkOut}` : ""}
                </span>
              ))}
            </div>
          </div>
          {blockedDate.blocked ? (
            <p className="mt-3 rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {blockedDate.reason}
            </p>
          ) : null}
        </div> : (
          <div className={`rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm ${compact ? "px-3 py-2" : "px-5 py-4"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Today&apos;s walk-in availability</p>
            <p className={`${compact ? "text-sm" : "mt-1 text-lg"} font-bold text-emerald-950`}>{today}</p>
          </div>
        )}

        <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</p>
          <div className={`${compact ? "mt-1 gap-1.5" : "mt-2 gap-2"} grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5`}>
            {categoryOptions.map((category) => {
              const categoryRoomCount = rooms.filter((room) => room.categoryId === category.id).length;
              const selected = selectedCategory?.id === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={`h-full w-full rounded-lg border px-3 ${compact ? "py-1.5" : "py-2.5"} text-left transition ${
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
                </button>
              );
            })}
          </div>
        </div>

        {selectedCategory ? (
          <section className={`grid ${compact ? "gap-1" : "gap-2"}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-slate-950">{selectedCategory.name}</h2>
              <p className="text-sm text-slate-500">{selectedCategory.description}</p>
            </div>

            <div className={`${todayOnly ? "min-h-0" : "max-h-[70vh] min-h-96"} overflow-auto overscroll-contain rounded border bg-white [scrollbar-gutter:stable]`}>
              <div className={`${todayOnly ? "min-w-[520px]" : "min-w-[1050px]"} w-full`}>
                {/* Header: days */}
                <div className="sticky top-0 z-20 border-b border-slate-300 bg-white px-2 py-3 shadow-sm">
                  <div className="grid items-center gap-1" style={calendarGridStyle}>
                    <div className="sticky left-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-r border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">
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
                    <div className="sticky left-0 z-30 border-r border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold text-slate-500 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">Day</div>
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
                    <div key={room.id} className={`grid items-center gap-2 border-t px-3 ${todayOnly ? "py-3" : "py-2"}`} style={calendarGridStyle}>
                      <div className="sticky left-0 z-10 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 self-stretch border-r border-slate-200 bg-white px-3 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">
                        <div className={`${todayOnly ? "text-lg" : "text-sm"} font-semibold leading-snug text-slate-900`}>{room.name}</div>
                        <div className={`whitespace-nowrap ${todayOnly ? "text-sm" : "text-xs"} font-medium text-slate-500`}>{formatPeso(room.pricePerNight)}</div>
                      </div>
                      {monthDays.map((day) => {
                        const blocked = findBlockedBookingDate(day, day, blockedDates);
                        const hasBooking = activeBookings.some((b) => b.roomId === room.id && dateRangesOverlap(b.checkIn, b.checkOut, day, day));
                        const isPastDate = day < today;
                        const disabled = isPastDate || room.available === false || hasBooking || blocked.blocked;
                        const cellStyle = hasBooking
                          ? "cursor-not-allowed border-amber-400 bg-amber-400 text-amber-950"
                          : disabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600";

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={disabled}
                            onClick={() => selectCell(room, day)}
                            className={`flex w-full items-center justify-center border font-bold transition ${todayOnly ? "h-14 rounded-lg text-sm" : "h-7 min-w-6 rounded-sm"} ${cellStyle}`}
                            title={
                              hasBooking
                                ? `${room.name} — Booked on ${day}`
                                : isPastDate
                                  ? `${day} — Past date`
                                  : `${room.name} — ${day}`
                            }
                          >
                            {todayOnly ? (hasBooking ? "Booked" : disabled ? "Unavailable" : "Available — Book walk-in") : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 md:hidden">
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
                    Past / blocked
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-sm border border-amber-400 bg-amber-400" />
                    Booked
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-rose-600 font-semibold">Sat / Sun</span>
                    Weekend
                  </span>
                </div>
              </div>

              {selectedRoom ? renderBookingForm("mobile") : null}

              {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
            </div>

            <dialog
              ref={bookingDialogRef}
              className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/55"
              onClose={() => setMessage("")}
            >
              {selectedRoom ? (
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Booking details</p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">{selectedRoom.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{effectiveDay} · {formatPeso(total)}</p>
                    </div>
                    <button type="button" onClick={() => bookingDialogRef.current?.close()} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Close
                    </button>
                  </div>
                  <div className="mt-5">{renderBookingForm("dialog")}</div>
                  {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
                </div>
              ) : null}
            </dialog>
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
  id,
  label,
  type = "text",
  value,
  required = true,
  onChange,
}: {
  id?: string;
  label: string;
  type?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const fieldId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <label htmlFor={fieldId} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

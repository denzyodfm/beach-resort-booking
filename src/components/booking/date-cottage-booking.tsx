"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { findBookingConflict } from "@/lib/booking-logic";
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

const today = new Date().toISOString().slice(0, 10);
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
  const [date, setDate] = useState(today);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryOptions[0]?.id || "");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [form, setForm] = useState<FormState>({
    guestName: user?.name || "",
    guestPhone: user?.phone || "",
    guestEmail: user?.email || "",
    guests: 2,
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bookingPanelRef = useRef<HTMLElement | null>(null);

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

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const total = selectedRoom ? selectedRoom.pricePerNight * nightsBetween(date, date) : 0;
  const selectedCategory = categoryOptions.find((category) => category.id === selectedCategoryId) || categoryOptions[0];
  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.categoryId === (selectedCategory?.id || "")),
    [rooms, selectedCategory?.id],
  );

  const activeBookings = useMemo(
    () => bookings.filter((booking) => activeStatuses.includes(booking.status)),
    [bookings],
  );

  function getDateBooking(roomId: string) {
    return findBookingConflict(activeBookings, roomId, date, date);
  }

  function selectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setMessage("");
    setSelectedRoomId((currentRoomId) => {
      const currentRoom = rooms.find((room) => room.id === currentRoomId);
      return currentRoom?.categoryId === categoryId ? currentRoomId : "";
    });
  }

  function selectRoom(room: Room) {
    if (room.available === false || getDateBooking(room.id)) return;
    setSelectedRoomId(room.id);
    setMessage("");
    setForm((current) => ({
      ...current,
      guestName: current.guestName || user?.name || "",
      guestPhone: current.guestPhone || user?.phone || "",
      guestEmail: current.guestEmail || user?.email || "",
      guests: Math.min(current.guests || 1, room.maxGuests),
    }));
    window.requestAnimationFrame(() => {
      bookingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) return;

    const conflict = getDateBooking(selectedRoom.id);
    if (conflict) {
      setMessage(`${selectedRoom.name} is already booked on ${date}.`);
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
      checkIn: date,
      checkOut: date,
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
          checkIn: date,
          checkOut: date,
          guests: form.guests,
          totalPrice: total,
          status: "pending",
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }

      setMessage(result.message || `${selectedRoom.name} is held as a pending booking for ${date}.`);
      setSelectedRoomId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="booking-date" className="text-sm font-semibold text-slate-700">
            Booking date
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="booking-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedRoomId("");
                setMessage("");
              }}
              className="min-h-12 rounded-md border border-slate-300 px-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
            />
            <p className="text-sm text-slate-500">
              {activeBookings.filter((booking) => findBookingConflict([booking], booking.roomId, date, date)).length} cottage booking(s) found for this date.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Category</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {categoryOptions.map((category) => {
              const categoryRoomCount = rooms.filter((room) => room.categoryId === category.id).length;
              const selected = selectedCategory?.id === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    selected
                      ? "border-bolihon-green bg-bolihon-green text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-bolihon-green hover:text-bolihon-green"
                  }`}
                >
                  <span className="block text-sm font-bold">{category.name}</span>
                  <span className={`mt-1 block text-xs ${selected ? "text-white/80" : "text-slate-500"}`}>
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room) => {
                const booking = getDateBooking(room.id);
                const disabled = room.available === false || Boolean(booking);
                const selected = selectedRoomId === room.id;

                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectRoom(room)}
                    className={`min-h-40 rounded-lg border p-4 text-left shadow-sm transition ${
                      selected
                        ? "border-bolihon-green bg-lime-50 ring-2 ring-bolihon-green/30"
                        : disabled
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                          : "border-slate-200 bg-white hover:border-bolihon-green hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-950">{room.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatPeso(room.pricePerNight)}/day - max {room.maxGuests}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          room.available === false
                            ? "bg-slate-200 text-slate-600"
                            : booking
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {room.available === false ? "Offline" : booking ? "Booked" : "Open"}
                      </span>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-slate-600">{room.description}</p>
                    {booking ? (
                      <div className="mt-4 rounded-md bg-white/70 px-3 py-2 text-sm">
                        {isManager ? (
                          <>
                            <p className="font-semibold text-slate-900">{booking.guestName || "Guest name unavailable"}</p>
                            <p className="mt-1 text-slate-600">{booking.guestPhone || booking.guestEmail || "No contact recorded"}</p>
                          </>
                        ) : (
                          <p className="font-semibold text-slate-600">Already reserved for this date</p>
                        )}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No cottage categories are available yet.
          </div>
        )}
      </div>

      <aside
        ref={bookingPanelRef}
        className="h-fit scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/10 lg:sticky lg:top-28"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Booking details</p>
        {selectedRoom ? (
          <form onSubmit={submitBooking} className="mt-4 grid gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{selectedRoom.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {date} - {formatPeso(total)}
              </p>
              <p className="mt-3 rounded-md bg-lime-50 px-3 py-2 text-sm font-medium text-lime-900">
                Complete this booking here. Your selected date stays locked to this request.
              </p>
            </div>
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
              disabled={submitting || form.guests < 1 || form.guests > selectedRoom.maxGuests || !form.guestPhone.trim()}
              className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Holding..." : "Hold this cottage"}
            </button>
          </form>
        ) : (
          <div className="mt-4 rounded-lg bg-cyan-50 p-4 text-sm text-cyan-950">
            Choose an open cottage from the date map to start the booking process on this page.
          </div>
        )}
        {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
      </aside>
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { findBookingConflict, getUnavailableRanges } from "@/lib/booking-logic";
import { saveDemoBooking } from "@/lib/demo-bookings";
import { getDemoBookings } from "@/lib/demo-bookings";
import type { Booking, Room } from "@/lib/types";
import { nightsBetween } from "@/lib/resort-data";

type AvailabilityState = "idle" | "checking" | "available" | "unavailable";
type CottageCategory = Room["type"];
type UnavailableRange = {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  label: string;
};

const categoryLabels: Record<CottageCategory, string> = {
  cove: "Cove",
  rock: "Rock",
  rd: "RD",
  hall: "VGP Hall",
  pavillon: "Pavillon",
};

const defaultCheckIn = new Date().toISOString().slice(0, 10);
const defaultCheckOut = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function normalizeBookingDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) return "";

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = slashMatch[3];
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;

  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function BookingForm({
  rooms,
  initialRoomId,
}: {
  rooms: Room[];
  initialRoomId?: string;
}) {
  const initialRoom = rooms.find((room) => room.id === initialRoomId);
  const categoryOptions = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.type))) as CottageCategory[],
    [rooms],
  );
  const [category, setCategory] = useState<CottageCategory>(initialRoom?.type || "cove");
  const [roomId, setRoomId] = useState(initialRoom?.id || rooms.find((room) => room.type === (initialRoom?.type || "cove"))?.id || rooms[0]?.id || "");
  const filteredRooms = useMemo(
    () => rooms.filter((room) => room.type === category),
    [category, rooms],
  );
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [message, setMessage] = useState("");
  const [unavailableRanges, setUnavailableRanges] = useState<UnavailableRange[]>([]);

  const selectedRoom = filteredRooms.find((room) => room.id === roomId) || filteredRooms[0] || rooms[0];
  const normalizedCheckIn = normalizeBookingDate(checkIn);
  const normalizedCheckOut = normalizeBookingDate(checkOut);
  const datesAreValid = Boolean(normalizedCheckIn && normalizedCheckOut);
  const nights = datesAreValid ? nightsBetween(normalizedCheckIn, normalizedCheckOut) : 0;
  const total = useMemo(
    () => (selectedRoom ? selectedRoom.pricePerNight * nights : 0),
    [nights, selectedRoom],
  );

  const mergeUnavailableRanges = useCallback((apiRanges: UnavailableRange[] = []) => {
    const localRanges = getUnavailableRanges(getDemoBookings(), roomId);
    const ranges = [...apiRanges, ...localRanges];
    const seen = new Set<string>();

    return ranges.filter((range) => {
      const key = `${range.bookingId}-${range.checkIn}-${range.checkOut}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [roomId]);

  function selectCategory(option: CottageCategory) {
    const nextRoom = rooms.find((room) => room.type === option);
    setCategory(option);
    setRoomId(nextRoom?.id || "");
    setAvailability("idle");
    setMessage("");
  }

  async function checkAvailability(options: { silent?: boolean } = {}) {
    setAvailability("checking");
    if (!options.silent) setMessage("");

    if (!datesAreValid || nights < 1) {
      setAvailability("unavailable");
      setMessage("Please select valid check-in and check-out dates.");
      return false;
    }

    const params = new URLSearchParams({ roomId, checkIn: normalizedCheckIn, checkOut: normalizedCheckOut });
    const response = await fetch(`/api/availability?${params.toString()}`);
    const result = (await response.json()) as {
      available: boolean;
      message?: string;
      unavailableRanges?: UnavailableRange[];
    };
    const localConflict = findBookingConflict(getDemoBookings(), roomId, normalizedCheckIn, normalizedCheckOut);
    const mergedRanges = mergeUnavailableRanges(result.unavailableRanges);
    const available = result.available && !localConflict;

    setUnavailableRanges(mergedRanges);
    setAvailability(available ? "available" : "unavailable");
    if (!options.silent || !available) {
      setMessage(
        localConflict
          ? `Unavailable: ${selectedRoom?.name || "This cottage"} is already booked from ${localConflict.checkIn} to ${localConflict.checkOut}.`
          : result.message || "",
      );
    }
    return available;
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const available = await checkAvailability({ silent: true });

    if (!available) return;

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        guestName,
        guestEmail,
        guestPhone,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        guests,
        totalPrice: total,
      }),
    });

    const result = (await response.json()) as { id?: string; booking?: Booking; message: string };
    setMessage(result.message);
    if (response.ok && selectedRoom) {
      saveDemoBooking(result.booking || {
        id: result.id || `DEMO-${Date.now()}`,
        roomId,
        roomName: selectedRoom.name,
        guestName,
        guestEmail,
        guestPhone,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        guests,
        totalPrice: total,
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString().slice(0, 10),
      });
      setAvailability("available");
    }
  }

  useEffect(() => {
    let active = true;

    if (!datesAreValid) {
      return () => {
        active = false;
      };
    }

    const params = new URLSearchParams({ roomId, checkIn: normalizedCheckIn, checkOut: normalizedCheckOut });

    fetch(`/api/availability?${params.toString()}`)
      .then((response) => response.json())
      .then((result: { unavailableRanges?: UnavailableRange[] }) => {
        if (active) setUnavailableRanges(mergeUnavailableRanges(result.unavailableRanges));
      })
      .catch(() => {
        if (active) setUnavailableRanges(mergeUnavailableRanges());
      });

    return () => {
      active = false;
    };
  }, [roomId, normalizedCheckIn, normalizedCheckOut, datesAreValid, mergeUnavailableRanges]);

  return (
    <form onSubmit={submitBooking} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/10">
      <div>
        <p className="text-sm font-semibold text-slate-700">Category</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {categoryOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => selectCategory(option)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                category === option
                  ? "border-bolihon-green bg-bolihon-green text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-bolihon-green hover:text-bolihon-green"
              }`}
            >
              {categoryLabels[option]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-700" htmlFor="room">
          Cottage
        </label>
        <select
          key={category}
          id="room"
          value={roomId}
          onChange={(event) => {
            setRoomId(event.target.value);
            setAvailability("idle");
            setMessage("");
          }}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
        >
          {filteredRooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} - Php{room.pricePerNight.toLocaleString()}/day
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Check-in"
          id="checkIn"
          type="date"
          value={checkIn}
          min={defaultCheckIn}
          onChange={(value) => {
            setCheckIn(value);
            setAvailability("idle");
          }}
        />
        <Field
          label="Check-out"
          id="checkOut"
          type="date"
          value={checkOut}
          min={normalizedCheckIn || defaultCheckIn}
          onChange={(value) => {
            setCheckOut(value);
            setAvailability("idle");
          }}
        />
      </div>

      <div className="rounded-md border border-cyan-100 bg-cyan-50 p-4">
        <p className="text-sm font-semibold text-cyan-950">Unavailable dates</p>
        {unavailableRanges.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {unavailableRanges.map((range) => (
              <span key={range.bookingId} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-900">
                {range.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-cyan-800">No unavailable dates for this cottage yet.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-700" htmlFor="guests">
            Guests
          </label>
          <input
            id="guests"
            type="number"
            min={1}
            max={selectedRoom?.maxGuests || 8}
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
          />
          {selectedRoom ? (
            <p className={`mt-2 text-sm ${guests > selectedRoom.maxGuests ? "text-rose-700" : "text-slate-500"}`}>
              Max {selectedRoom.maxGuests} guests for {selectedRoom.name}.
            </p>
          ) : null}
        </div>
        <div className="rounded-md bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">Php{total.toLocaleString()}</p>
          <p className="text-sm text-slate-600">{nights} day{nights === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest name" id="guestName" value={guestName} onChange={setGuestName} />
        <Field label="Cellphone no." id="guestPhone" type="tel" value={guestPhone} onChange={setGuestPhone} />
        <Field label="Email (optional)" id="guestEmail" type="email" value={guestEmail} onChange={setGuestEmail} required={false} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            void checkAvailability();
          }}
          className="rounded-full border border-cyan-800 px-5 py-3 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-50"
        >
          {availability === "checking" ? "Checking..." : "Check availability"}
        </button>
        <button
          type="submit"
          disabled={!datesAreValid || nights < 1 || guests > (selectedRoom?.maxGuests || 0) || availability === "unavailable" || !guestPhone.trim()}
          className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Hold as pending booking
        </button>
      </div>

      {message ? (
        <p className={`rounded-md px-4 py-3 text-sm ${availability === "unavailable" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  id,
  type = "text",
  value,
  min,
  required = true,
  onChange,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  min?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

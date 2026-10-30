"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, CalendarSearch, Loader2 } from "lucide-react";
import { findBlockedBookingDate, type BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { findBookingConflict, getUnavailableRanges } from "@/lib/booking-logic";
import {
  getBookingCharges,
  getPremiumFee,
  partySize,
  type BookingSettings,
  type BookingType,
  type GuestParty,
} from "@/lib/booking-settings";
import { saveDemoBooking } from "@/lib/demo-bookings";
import { getDemoBookings } from "@/lib/demo-bookings";
import type { Booking, CottageCategory, Room } from "@/lib/types";
import { nightsBetween } from "@/lib/resort-data";
import { hasPersistentBackend } from "@/lib/backend-mode";
import {
  BookingTypeChooser,
  ChargeBreakdown,
  guestViewFromNewBooking,
  InternetAccessOption,
  PartyFields,
  PayBeforeNotice,
} from "./booking-options";
import { BookingPaymentPanel, type GuestBookingView } from "./payment-panel";

type AvailabilityState = "idle" | "checking" | "available" | "unavailable";
type CottageCategoryId = Room["type"];
type UnavailableRange = {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  label: string;
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
  categories,
  initialRoomId,
  settings,
}: {
  rooms: Room[];
  categories: CottageCategory[];
  initialRoomId?: string;
  settings: BookingSettings;
}) {
  const initialRoom = rooms.find((room) => room.id === initialRoomId);
  const categoryOptions = useMemo(
    () => categories.filter((category) => rooms.some((room) => room.categoryId === category.id)),
    [categories, rooms],
  );
  const [category, setCategory] = useState<CottageCategoryId>(initialRoom?.categoryId || categoryOptions[0]?.id || "cove");
  const [roomId, setRoomId] = useState(initialRoom?.id || rooms.find((room) => room.categoryId === (initialRoom?.categoryId || categoryOptions[0]?.id))?.id || rooms[0]?.id || "");
  // Arriving from "Book this cottage" means the guest already picked one: Premium.
  const [bookingType, setBookingType] = useState<BookingType>(initialRoom ? "premium" : "standard");
  const [internetAccess, setInternetAccess] = useState(false);
  const filteredRooms = useMemo(
    () => rooms.filter((room) => room.categoryId === category),
    [category, rooms],
  );
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [party, setParty] = useState<GuestParty>({ regular: 2, child: 0, senior: 0 });
  const guests = partySize(party);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [message, setMessage] = useState("");
  const [unavailableRanges, setUnavailableRanges] = useState<UnavailableRange[]>([]);
  const [blockedDates, setBlockedDates] = useState<BookingBlockedDate[]>([]);
  const [confirmation, setConfirmation] = useState<GuestBookingView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const backendConfigured = hasPersistentBackend();
  const standardMode = bookingType === "standard";

  const selectedRoom = filteredRooms.find((room) => room.id === roomId) || filteredRooms[0] || rooms[0];
  // Standard bookings are quoted on the cheapest cottage in the category; the
  // server assigns a free cottage with that same total.
  const quoteRoom = standardMode
    ? filteredRooms.slice().sort((a, b) => a.pricePerNight - b.pricePerNight)[0]
    : selectedRoom;
  const normalizedCheckIn = normalizeBookingDate(checkIn);
  const normalizedCheckOut = normalizeBookingDate(checkOut);
  const datesAreValid = Boolean(normalizedCheckIn && normalizedCheckOut);
  const nights = datesAreValid ? nightsBetween(normalizedCheckIn, normalizedCheckOut) : 0;
  const blockedDate = datesAreValid ? findBlockedBookingDate(normalizedCheckIn, normalizedCheckOut, blockedDates) : { blocked: false, reason: "" };
  const charges = quoteRoom
    ? getBookingCharges({ room: quoteRoom, days: nights, settings, bookingType, internetAccess, party })
    : null;
  const total = charges?.total || 0;

  const mergeUnavailableRanges = useCallback((apiRanges: UnavailableRange[] = []) => {
    const localRanges = backendConfigured ? [] : getUnavailableRanges(getDemoBookings(), roomId);
    const ranges = [...apiRanges, ...localRanges];
    const seen = new Set<string>();

    return ranges.filter((range) => {
      const key = `${range.bookingId}-${range.checkIn}-${range.checkOut}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [roomId, backendConfigured]);

  function selectCategory(option: CottageCategoryId) {
    const nextRoom = rooms.find((room) => room.categoryId === option);
    setCategory(option);
    setRoomId(nextRoom?.id || "");
    setAvailability("idle");
    setMessage("");
  }

  function availabilityParams() {
    return new URLSearchParams(
      standardMode
        ? { categoryId: category, checkIn: normalizedCheckIn, checkOut: normalizedCheckOut }
        : { roomId, checkIn: normalizedCheckIn, checkOut: normalizedCheckOut },
    );
  }

  async function checkAvailability(options: { silent?: boolean } = {}) {
    setAvailability("checking");
    if (!options.silent) setMessage("");

    if (!datesAreValid || nights < 1) {
      setAvailability("unavailable");
      setMessage("Please select valid check-in and check-out dates.");
      return false;
    }

    if (blockedDate.blocked) {
      setAvailability("unavailable");
      setMessage(blockedDate.reason);
      return false;
    }

    const response = await fetch(`/api/availability?${availabilityParams().toString()}`);
    const result = (await response.json()) as {
      available: boolean;
      message?: string;
      unavailableRanges?: UnavailableRange[];
    };
    const localConflict = backendConfigured || standardMode ? null : findBookingConflict(getDemoBookings(), roomId, normalizedCheckIn, normalizedCheckOut);
    const available = result.available && !localConflict;

    if (!standardMode) setUnavailableRanges(mergeUnavailableRanges(result.unavailableRanges));
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

    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(standardMode ? { categoryId: category } : { roomId }),
          bookingType,
          internetAccess,
          guestName,
          guestEmail,
          guestPhone,
          checkIn: normalizedCheckIn,
          checkOut: normalizedCheckOut,
          guests,
          party,
          totalPrice: total,
        }),
      });

      const result = (await response.json()) as Parameters<typeof guestViewFromNewBooking>[0] & { id?: string; message: string };
      if (response.ok && backendConfigured) {
        setConfirmation(guestViewFromNewBooking(result, { checkIn: normalizedCheckIn, checkOut: normalizedCheckOut, guests, guestName }));
        setMessage("");
        return;
      }

      setMessage(result.message);
      if (response.ok && selectedRoom && !backendConfigured) {
        const source = (result.booking || {}) as Record<string, unknown>;
        saveDemoBooking({
          id: String(source.id || source.booking_number || result.id || `DEMO-${window.crypto.randomUUID()}`),
          roomId: String(source.roomId || source.room_id || roomId),
          roomName: String((source.rooms as { name?: string } | undefined)?.name || source.roomName || selectedRoom.name),
          guestName: String(source.guestName || source.guest_name || guestName),
          guestEmail: String(source.guestEmail || source.guest_email || guestEmail || ""),
          guestPhone: String(source.guestPhone || source.guest_phone || guestPhone),
          checkIn: String(source.checkIn || source.check_in || normalizedCheckIn),
          checkOut: String(source.checkOut || source.check_out || normalizedCheckOut),
          guests: Number(source.guests || source.guest_count || guests),
          totalPrice: Number(source.totalPrice || source.total_amount || total),
          status: (source.status || "pending") as Booking["status"],
          paymentStatus: (source.paymentStatus || source.payment_status || "unpaid") as Booking["paymentStatus"],
          createdAt: String(source.createdAt || source.created_at || new Date().toISOString()).slice(0, 10),
        });
        setAvailability("available");
      } else if (!response.ok) {
        setAvailability("unavailable");
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    let active = true;

    if (!datesAreValid || standardMode) {
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
  }, [roomId, normalizedCheckIn, normalizedCheckOut, datesAreValid, mergeUnavailableRanges, standardMode]);

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

  if (confirmation) {
    return (
      <div className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Booked — pay to keep it</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{confirmation.roomName}</h2>
        </div>
        <BookingPaymentPanel booking={confirmation} guestPhone={guestPhone} onUpdated={setConfirmation} />
        <button
          type="button"
          onClick={() => {
            setConfirmation(null);
            setAvailability("idle");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <CalendarPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
          Make another booking
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitBooking} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/10">
      <div>
        <p className="text-sm font-semibold text-slate-700">How do you want to book?</p>
        <div className="mt-2">
          <BookingTypeChooser
            value={bookingType}
            onChange={(value) => {
              setBookingType(value);
              setAvailability("idle");
              setMessage("");
            }}
            premiumFee={selectedRoom ? getPremiumFee(selectedRoom, settings) : settings.premiumFeeAmount}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700">Category</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {categoryOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectCategory(option.id)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                category === option.id
                  ? "border-bolihon-green bg-bolihon-green text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-bolihon-green hover:text-bolihon-green"
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      {standardMode ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong>Standard booking:</strong> the resort assigns an available cottage in this category. You will see the
          cottage number right after booking.
        </p>
      ) : (
        <div>
          <label className="text-sm font-semibold text-slate-700" htmlFor="room">
            Your preferred cottage
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
      )}

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

      {blockedDate.blocked ? (
        <p className="rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {blockedDate.reason}
        </p>
      ) : null}

      <div className="rounded-md border border-cyan-100 bg-cyan-50 p-4">
        <p className="text-sm font-semibold text-cyan-950">Booking includes</p>
        <div className="mt-3 grid gap-2">
          {(quoteRoom?.bookingIncludes || []).map((item) => (
            <span key={item} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-cyan-900">
              {item}
            </span>
          ))}
        </div>
      </div>

      <PayBeforeNotice holdHours={quoteRoom?.reservationHoldHours || 24} />

      {!standardMode ? (
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
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PartyFields id="guests" settings={settings} party={party} maxGuests={quoteRoom?.maxGuests || 8} onChange={setParty} />
        <InternetAccessOption id="booking-internet" settings={settings} checked={internetAccess} onChange={setInternetAccess} />
      </div>

      {charges && nights > 0 ? <ChargeBreakdown charges={charges} days={nights} /> : null}

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
          className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-800 px-5 py-3 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-50"
        >
          {availability === "checking" ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : <CalendarSearch aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {availability === "checking" ? "Checking..." : "Check availability"}
        </button>
        <button
          type="submit"
          disabled={submitting || !datesAreValid || nights < 1 || blockedDate.blocked || guests > (quoteRoom?.maxGuests || 0) || availability === "unavailable" || !guestPhone.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {submitting ? "Booking..." : `Book now · Php${total.toLocaleString()}`}
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

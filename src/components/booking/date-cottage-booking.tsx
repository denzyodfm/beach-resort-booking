"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarPlus, Loader2, Wallet, X } from "lucide-react";
import { findBlockedBookingDate, type BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { findBookingConflict, dateRangesOverlap } from "@/lib/booking-logic";
import { readBookingExtras } from "@/lib/booking-row";
import {
  formatDeadline,
  formatPeso,
  getBookingChannel,
  getBookingCharges,
  getPremiumFee,
  paymentStatusLabel,
  partySize,
  type BookingSettings,
  type BookingType,
  type GuestParty,
} from "@/lib/booking-settings";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";
import { getDemoBookings, saveDemoBooking } from "@/lib/demo-bookings";
import { hasPersistentBackend } from "@/lib/backend-mode";
import type { Booking, BookingStatus, CottageCategory, PaymentLog, PaymentStatus, Room } from "@/lib/types";
import {
  BookingTypeChooser,
  ChargeBreakdown,
  guestViewFromNewBooking,
  InternetAccessOption,
  PartyFields,
  PayBeforeNotice,
} from "./booking-options";
import { BookingPaymentPanel, PaymentDeadlineBanner, type GuestBookingView } from "./payment-panel";

type BookingRow = Booking | Record<string, unknown>;
type FormState = {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guests: number;
};

const activeStatuses: BookingStatus[] = ["pending", "confirmed", "checked_in"];

function normalizeBooking(row: BookingRow): Booking {
  const source = row as Record<string, unknown>;
  const nestedRoom = source.rooms as { name?: string } | undefined;
  let paymentDetails: Record<string, unknown> = {};
  try {
    paymentDetails = typeof source.special_requests === "string" ? JSON.parse(source.special_requests) : {};
  } catch {
    paymentDetails = {};
  }

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
    paymentNote: String(paymentDetails.paymentNote || source.paymentNote || ""),
    paymentAmountPaid: Number(paymentDetails.paymentAmountPaid || source.paymentAmountPaid || 0),
    paymentHistory: Array.isArray(paymentDetails.paymentHistory) ? paymentDetails.paymentHistory as PaymentLog[] : [],
    createdAt: String(source.createdAt || source.created_at || new Date().toISOString()).slice(0, 10),
    ...readBookingExtras(source),
  };
}

export function DateCottageBooking({
  rooms,
  categories,
  resortToday,
  settings,
  todayOnly = false,
  compact = false,
}: {
  rooms: Room[];
  categories: CottageCategory[];
  resortToday: string;
  settings: BookingSettings;
  todayOnly?: boolean;
  compact?: boolean;
}) {
  const today = resortToday;
  const todayMonth = today.slice(0, 7);
  const { user } = useDemoAuth();
  const isManager = canManageResort(user?.role);
  const backendConfigured = hasPersistentBackend();
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
  // Walk-in (today-only) bookings always name the cottage; online bookings start as Standard.
  const [bookingType, setBookingType] = useState<BookingType>(todayOnly ? "premium" : "standard");
  const [standardDaySelected, setStandardDaySelected] = useState(false);
  const [internetAccess, setInternetAccess] = useState(false);
  // Entrance fee mix; form.guests always equals its total.
  const [party, setParty] = useState<GuestParty>({ regular: 2, child: 0, senior: 0 });
  const [confirmation, setConfirmation] = useState<GuestBookingView | null>(null);
  const [form, setForm] = useState<FormState>({
    guestName: user?.name || "",
    guestPhone: user?.phone || "",
    guestEmail: user?.email || "",
    guests: 2,
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedExistingBooking, setSelectedExistingBooking] = useState<Booking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const bookingDialogRef = useRef<HTMLDialogElement>(null);
  const standardMode = !todayOnly && bookingType === "standard";

  useEffect(() => {
    let active = true;

    function mergeBookings(apiRows: BookingRow[]) {
      const apiBookings = apiRows.map(normalizeBooking);
      if (backendConfigured) return apiBookings;

      const localBookings = getDemoBookings().map(normalizeBooking);
      const apiIds = new Set(apiBookings.map((booking) => booking.id));
      return [...apiBookings, ...localBookings.filter((booking) => !apiIds.has(booking.id))];
    }

    const syncBookings = () => {
      if (!backendConfigured) {
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
  }, [isManager, backendConfigured]);

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
  const blockedDate = findBlockedBookingDate(effectiveDay, effectiveDay, blockedDates);
  const selectedCategory = categoryOptions.find((category) => category.id === selectedCategoryId) || categoryOptions[0];
  const visibleRooms = useMemo(
    () => rooms
      .filter((room) => room.categoryId === selectedCategory?.id)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })),
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

  /** Online cottages in the category still free on a day, cheapest first. */
  function getFreeRooms(day: string) {
    return visibleRooms
      .filter((room) => room.available !== false && !getDateBooking(room.id, day))
      .sort((a, b) => a.pricePerNight - b.pricePerNight);
  }

  // Standard bookings are quoted on the cheapest free cottage; the server only
  // assigns cottages with that same total.
  const freeRoomsForDay = standardMode && standardDaySelected ? getFreeRooms(effectiveDay) : [];
  const quoteRoom = standardMode ? (standardDaySelected ? freeRoomsForDay[0] : undefined) : selectedRoom;
  const quoteType: BookingType = quoteRoom && getBookingChannel(quoteRoom) === "walk_in" ? "premium" : bookingType;
  const charges = quoteRoom
    ? getBookingCharges({ room: quoteRoom, days: 1, settings, bookingType: quoteType, internetAccess, party })
    : null;
  const quoteIsOnline = quoteRoom ? getBookingChannel(quoteRoom) === "online" : false;

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

  function resetSelection() {
    setSelectedRoomId("");
    setStandardDaySelected(false);
    setConfirmation(null);
  }

  function selectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setMessage("");
    setStandardDaySelected(false);
    setSelectedRoomId((currentRoomId) => {
      const currentRoom = rooms.find((room) => room.id === currentRoomId);
      return currentRoom?.categoryId === categoryId ? currentRoomId : "";
    });
  }

  function changeBookingType(type: BookingType) {
    setBookingType(type);
    setMessage("");
    resetSelection();
  }

  function openBookingDialog() {
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        bookingDialogRef.current?.showModal();
        window.requestAnimationFrame(() => document.getElementById("dialog-guest-name")?.focus());
      } else {
        document.getElementById("mobile-guest-name")?.focus();
      }
    });
  }

  function isBookableDay(day: string) {
    if (day < today) {
      setMessage("Past dates are not available for booking.");
      return false;
    }

    const blocked = findBlockedBookingDate(day, day, blockedDates);
    if (blocked.blocked) {
      setMessage(blocked.reason);
      return false;
    }
    return true;
  }

  function selectCell(room: Room, day: string) {
    if (!isBookableDay(day)) return;

    const conflict = getDateBooking(room.id, day);
    if (conflict && isManager) {
      openBookedCottage(room, day, conflict);
      return;
    }
    if (room.available === false || conflict) return;

    setSelectedExistingBooking(null);
    setConfirmation(null);
    setStandardDaySelected(false);
    setSelectedDay(day);
    setSelectedRoomId(room.id);
    setMessage("");
    openBookingDialog();
  }

  function selectStandardDay(day: string) {
    if (!isBookableDay(day)) return;
    if (!getFreeRooms(day).length) return;

    setSelectedExistingBooking(null);
    setConfirmation(null);
    setSelectedRoomId("");
    setSelectedDay(day);
    setStandardDaySelected(true);
    setMessage("");
    openBookingDialog();
  }

  function openBookedCottage(room: Room, day: string, booking: Booking) {
    const balance = Math.max(0, booking.totalPrice - (booking.paymentAmountPaid || 0));
    setSelectedRoomId(room.id);
    setStandardDaySelected(false);
    setConfirmation(null);
    setSelectedDay(day);
    setSelectedExistingBooking(booking);
    setPaymentAmount(String(balance));
    setPaymentNote(booking.paymentNote || "");
    setPaymentReference(booking.paymentReference || "");
    setPaidBy(booking.guestName || "");
    setMessage("");
    window.requestAnimationFrame(() => bookingDialogRef.current?.showModal());
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quoteRoom || !charges) return;

    if (blockedDate.blocked) {
      setMessage(blockedDate.reason);
      return;
    }

    if (!standardMode && getDateBooking(quoteRoom.id)) {
      setMessage(`${quoteRoom.name} is already booked on ${effectiveDay}.`);
      return;
    }

    if (!form.guestPhone.trim()) {
      setMessage("Cellphone number is required for booking confirmation.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const payload = {
      ...(standardMode ? { categoryId: selectedCategory?.id } : { roomId: quoteRoom.id }),
      bookingType: quoteType,
      internetAccess,
      guestName: form.guestName,
      guestEmail: form.guestEmail,
      guestPhone: form.guestPhone,
      checkIn: effectiveDay,
      checkOut: effectiveDay,
      guests: form.guests,
      party,
      totalPrice: charges.total,
    };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as Parameters<typeof guestViewFromNewBooking>[0] & { message?: string };

      if (!response.ok && backendConfigured) {
        throw new Error(result.message || "Unable to save booking.");
      }

      if (!backendConfigured) {
        const source = (result.booking || {}) as Record<string, unknown>;
        saveDemoBooking({
          id: String(source.id || source.booking_number || `DEMO-${window.crypto.randomUUID()}`),
          roomId: quoteRoom.id,
          roomName: quoteRoom.name,
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone,
          checkIn: effectiveDay,
          checkOut: effectiveDay,
          guests: form.guests,
          totalPrice: charges.total,
          status: "pending",
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }

      window.dispatchEvent(new Event("bolihon-bookings-updated"));

      if (response.ok && result.channel === "online") {
        // Keep the window open on the payment step: deadline, where to pay and the reference box.
        setConfirmation(
          guestViewFromNewBooking(result, {
            checkIn: effectiveDay,
            checkOut: effectiveDay,
            guests: form.guests,
            guestName: form.guestName,
          }),
        );
        return;
      }

      setMessage(result.message || `${quoteRoom.name} is held as a pending booking for ${effectiveDay}.`);
      resetSelection();
      bookingDialogRef.current?.close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedExistingBooking) return;
    const amount = Number(paymentAmount);
    const currentPaid = selectedExistingBooking.paymentAmountPaid || 0;
    const nextPaid = Math.min(selectedExistingBooking.totalPrice, currentPaid + amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a payment amount greater than zero.");
      return;
    }
    if (selectedExistingBooking.channel === "online" && !paymentReference.trim()) {
      setMessage("Online bookings are paid online. Enter the payment reference number you matched against the GCash or bank record.");
      return;
    }

    const paymentLog: PaymentLog = {
      id: `PAY-${window.crypto.randomUUID()}`,
      type: "payment",
      amount,
      note: [paymentReference.trim() ? `Ref ${paymentReference.trim()}` : "", paymentNote.trim()].filter(Boolean).join(" · "),
      paidBy: paidBy.trim() || selectedExistingBooking.guestName,
      actorName: user?.name || user?.email || "Staff",
      actorRole: user?.role || "staff",
      createdAt: new Date().toISOString(),
      balanceAfter: Math.max(0, selectedExistingBooking.totalPrice - nextPaid),
    };

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedExistingBooking.id,
          paymentStatus: nextPaid >= selectedExistingBooking.totalPrice ? "paid" : "deposit_paid",
          paymentNote: paymentNote.trim(),
          paymentAmountPaid: nextPaid,
          paymentHistory: [...(selectedExistingBooking.paymentHistory || []), paymentLog],
          ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to record payment.");
      setSelectedExistingBooking(null);
      setSelectedRoomId("");
      bookingDialogRef.current?.close();
      window.dispatchEvent(new Event("bolihon-bookings-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record payment.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderBookingForm(prefix: string) {
    if (!quoteRoom || !charges) return null;

    return (
      <form onSubmit={submitBooking} className="grid gap-4">
        {quoteIsOnline ? (
          <PayBeforeNotice holdHours={quoteRoom.reservationHoldHours || 24} />
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Walk-in booking. If payment is not recorded within {quoteRoom.reservationHoldHours || 24} hours, it is cancelled
            automatically.
          </p>
        )}
        {standardMode ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <strong>Standard booking:</strong> the resort assigns one of the {freeRoomsForDay.length} available
            cottage{freeRoomsForDay.length === 1 ? "" : "s"} in {selectedCategory?.name} on {effectiveDay}. You will see
            the cottage number right after booking. Want a specific cottage? Switch to <strong>Premium booking</strong>.
          </p>
        ) : null}
        <ChargeBreakdown charges={charges} days={1} />
        <InternetAccessOption id={`${prefix}-internet`} settings={settings} checked={internetAccess} onChange={setInternetAccess} />
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
        <PartyFields
          id={`${prefix}-guests`}
          settings={settings}
          party={party}
          maxGuests={quoteRoom.maxGuests}
          onChange={(next) => {
            setParty(next);
            setForm((current) => ({ ...current, guests: partySize(next) }));
          }}
        />
        <button
          type="submit"
          disabled={submitting || blockedDate.blocked || form.guests < 1 || form.guests > quoteRoom.maxGuests || !form.guestPhone.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : quoteIsOnline ? <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" /> : <CalendarPlus aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {submitting ? "Booking..." : quoteIsOnline ? `Book now · ${formatPeso(charges.total)}` : "Hold this cottage"}
        </button>
      </form>
    );
  }

  const dialogTitle = confirmation
    ? confirmation.roomName
    : selectedRoom?.name || (standardMode && selectedCategory ? `Any available cottage · ${selectedCategory.name}` : "");
  const dialogEyebrow = confirmation
    ? "Booked — pay to keep it"
    : selectedExistingBooking
      ? "Cottage payment"
      : standardMode
        ? "Standard booking"
        : quoteIsOnline
          ? "Premium booking"
          : "Booking details";

  return (
    <div className={`grid lg:grid-cols-1 ${compact ? "gap-2" : "gap-3"}`}>
      <div className={compact ? "grid gap-2" : "grid gap-3"}>
        {!todayOnly ? (
          <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">How do you want to book?</p>
            <BookingTypeChooser
              value={bookingType}
              onChange={changeBookingType}
              premiumFee={visibleRooms[0] ? getPremiumFee(visibleRooms[0], settings) : settings.premiumFeeAmount}
              compact={compact}
            />
          </div>
        ) : null}

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
                resetSelection();
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
        </div> : null}

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

            {todayOnly ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {visibleRooms.map((room) => {
                  const blocked = findBlockedBookingDate(today, today, blockedDates);
                  const dateBooking = activeBookings.find((booking) => booking.roomId === room.id && dateRangesOverlap(booking.checkIn, booking.checkOut, today, today));
                  const hasBooking = Boolean(dateBooking);
                  const disabled = room.available === false || hasBooking || blocked.blocked;
                  const cardStyle = hasBooking
                    ? "cursor-not-allowed border-amber-300 bg-amber-50 text-amber-950"
                    : disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md";

                  return (
                    <button
                      key={room.id}
                      type="button"
                      disabled={disabled && !(hasBooking && isManager)}
                      onClick={() => dateBooking && isManager ? openBookedCottage(room, today, dateBooking) : selectCell(room, today)}
                      className={`flex min-h-36 flex-col justify-between rounded-xl border p-4 text-left transition ${cardStyle}`}
                    >
                      <span>
                        <span className="block text-lg font-bold">{room.name}</span>
                        <span className={`mt-1 block text-sm font-semibold ${disabled ? "text-current" : "text-white/85"}`}>{formatPeso(room.pricePerNight)}</span>
                      </span>
                      <span className="mt-5 block text-sm font-bold">
                        {dateBooking ? <><span className="block">Booked today</span><span className="mt-1 block font-semibold">Guest: {dateBooking.guestName || "Not provided"}</span>{isManager ? <span className="mt-1 block text-xs">Click to record payment</span> : null}</> : disabled ? "Unavailable" : <span className="inline-flex items-center gap-2"><CalendarPlus aria-hidden="true" className="h-4 w-4 shrink-0" />Available — Book walk-in</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
            <div className="max-h-[70vh] min-h-48 overflow-auto overscroll-contain rounded border bg-white [scrollbar-gutter:stable]">
              <div className="w-full min-w-[1050px]">
                {/* Header: days */}
                <div className="sticky top-0 z-20 border-b border-slate-300 bg-white px-2 py-3 shadow-sm">
                  <div className="grid items-center gap-1" style={calendarGridStyle}>
                    <div className="sticky left-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-r border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">
                      <span>{standardMode ? "Category" : "Cottage"}</span>
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

                {standardMode ? (
                  <div className="grid items-center gap-2 border-t px-3 py-3" style={calendarGridStyle}>
                    <div className="sticky left-0 z-10 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 self-stretch border-r border-slate-200 bg-white px-3 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">
                      <div className="text-sm font-semibold leading-snug text-slate-900">
                        Any available cottage
                        <span className="block text-xs font-medium text-slate-500">Number = cottages free</span>
                      </div>
                      <div className="whitespace-nowrap text-xs font-medium text-slate-500">
                        {visibleRooms.length ? `from ${formatPeso(Math.min(...visibleRooms.map((room) => room.pricePerNight)))}` : ""}
                      </div>
                    </div>
                    {monthDays.map((day) => {
                      const blocked = findBlockedBookingDate(day, day, blockedDates);
                      const freeCount = day < today || blocked.blocked ? 0 : getFreeRooms(day).length;
                      const disabled = freeCount === 0;
                      const selected = standardDaySelected && day === effectiveDay;

                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={disabled}
                          onClick={() => selectStandardDay(day)}
                          className={`flex h-9 w-full min-w-6 items-center justify-center rounded-sm border text-xs font-black transition ${
                            disabled
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                          }`}
                          title={disabled ? `${day} — not available` : `${day} — ${freeCount} cottage${freeCount === 1 ? "" : "s"} free`}
                        >
                          {day < today || blocked.blocked ? "" : freeCount}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                <div>
                  {visibleRooms.map((room) => (
                    <div key={room.id} className="grid items-center gap-2 border-t px-3 py-2" style={calendarGridStyle}>
                      <div className="sticky left-0 z-10 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 self-stretch border-r border-slate-200 bg-white px-3 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.35)]">
                        <div className="text-sm font-semibold leading-snug text-slate-900">{room.name}</div>
                        <div className="whitespace-nowrap text-xs font-medium text-slate-500">{formatPeso(room.pricePerNight)}</div>
                      </div>
                      {monthDays.map((day) => {
                        const blocked = findBlockedBookingDate(day, day, blockedDates);
                        const dateBooking = activeBookings.find((b) => b.roomId === room.id && dateRangesOverlap(b.checkIn, b.checkOut, day, day));
                        const hasBooking = Boolean(dateBooking);
                        const isPastDate = day < today;
                        const disabled = isPastDate || room.available === false || hasBooking || blocked.blocked;
                        const cellStyle = hasBooking
                          ? `${isManager ? "cursor-pointer hover:bg-amber-500" : "cursor-not-allowed"} border-amber-400 bg-amber-400 text-amber-950`
                          : disabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600";

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={disabled && !(hasBooking && isManager)}
                            onClick={() => dateBooking && isManager ? openBookedCottage(room, day, dateBooking) : selectCell(room, day)}
                            className={`flex h-7 w-full min-w-6 items-center justify-center rounded-sm border font-bold transition ${cellStyle}`}
                            title={
                              hasBooking
                                ? `${room.name} — Booked${isManager ? ` by ${dateBooking?.guestName || "guest"}` : ""} on ${day}${isManager ? ". Click to record payment." : ""}`
                                : isPastDate
                                  ? `${day} — Past date`
                                  : `${room.name} — ${day}`
                            }
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 md:hidden">
              <div className="mb-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">Booking details</p>
                  {quoteRoom ? (
                    <p className="mt-2 text-sm text-slate-600">
                      Selected <span className="font-semibold text-slate-900">{standardMode ? `any available cottage in ${selectedCategory.name}` : quoteRoom.name}</span> on <span className="font-semibold text-slate-900">{effectiveDay}</span>.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      Tap a green cell to choose an available {standardMode ? "date" : "cottage and date"}.
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

              {confirmation ? (
                <BookingPaymentPanel booking={confirmation} guestPhone={form.guestPhone} onUpdated={setConfirmation} />
              ) : quoteRoom ? renderBookingForm("mobile") : null}

              {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
            </div>

            <dialog
              ref={bookingDialogRef}
              className="m-auto max-h-[calc(100vh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/55"
              onClose={() => {
                setMessage("");
                if (confirmation) resetSelection();
              }}
            >
              {dialogTitle ? (
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{dialogEyebrow}</p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">{dialogTitle}</h2>
                      {!confirmation ? (
                        <p className="mt-1 text-sm text-slate-600">{effectiveDay} · {formatPeso(selectedExistingBooking?.totalPrice || charges?.total || 0)}</p>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => bookingDialogRef.current?.close()} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      <X aria-hidden="true" className="h-4 w-4 shrink-0" />
                      Close
                    </button>
                  </div>
                  <div className="mt-5">
                    {confirmation ? (
                      <BookingPaymentPanel booking={confirmation} guestPhone={form.guestPhone} onUpdated={setConfirmation} />
                    ) : selectedExistingBooking ? (
                      <form onSubmit={recordPayment} className="grid gap-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                          <p className="font-bold">Guest: {selectedExistingBooking.guestName || "Not provided"}</p>
                          <p className="mt-1">
                            {selectedExistingBooking.channel === "online" ? "Online booking" : selectedExistingBooking.channel === "walk_in" ? "Walk-in" : "Booking"}
                            {selectedExistingBooking.bookingType ? ` · ${selectedExistingBooking.bookingType}` : ""} · {paymentStatusLabel(selectedExistingBooking.paymentStatus)}
                          </p>
                          <p className="mt-1">Total: {formatPeso(selectedExistingBooking.totalPrice)}</p>
                          <p className="mt-1">Paid: {formatPeso(selectedExistingBooking.paymentAmountPaid || 0)}</p>
                          <p className="mt-1 font-bold">Balance: {formatPeso(Math.max(0, selectedExistingBooking.totalPrice - (selectedExistingBooking.paymentAmountPaid || 0)))}</p>
                          {selectedExistingBooking.paymentReference ? (
                            <p className="mt-1 font-bold">Guest reference no.: <span className="font-mono">{selectedExistingBooking.paymentReference}</span></p>
                          ) : null}
                        </div>
                        {selectedExistingBooking.status === "pending" && selectedExistingBooking.paymentStatus === "unpaid" ? (
                          <PaymentDeadlineBanner deadline={selectedExistingBooking.paymentDeadline} compact />
                        ) : null}
                        <Field
                          id="monitoring-payment-reference"
                          label={selectedExistingBooking.channel === "online" ? "Payment reference no. (required for online bookings)" : "Payment reference no. (optional)"}
                          required={selectedExistingBooking.channel === "online"}
                          value={paymentReference}
                          onChange={setPaymentReference}
                        />
                        <Field id="monitoring-payment-amount" label="Payment amount" type="number" value={paymentAmount} onChange={setPaymentAmount} />
                        <Field id="monitoring-paid-by" label="Paid by" value={paidBy} onChange={setPaidBy} />
                        <Field id="monitoring-payment-note" label="Payment note" required={false} value={paymentNote} onChange={setPaymentNote} />
                        <button type="submit" disabled={submitting || Number(paymentAmount) <= 0} className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : <Wallet aria-hidden="true" className="h-4 w-4 shrink-0" />}
                          {submitting ? "Recording..." : "Record cottage payment"}
                        </button>
                      </form>
                    ) : renderBookingForm("dialog")}
                  </div>
                  {message ? <p className="mt-4 rounded-md bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p> : null}
                  {confirmation ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Closed this window? Use <strong>Pay / Track Booking</strong> in the top menu with your booking number
                      {confirmation.paymentDeadline ? ` before ${formatDeadline(confirmation.paymentDeadline)}` : ""}.
                    </p>
                  ) : null}
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

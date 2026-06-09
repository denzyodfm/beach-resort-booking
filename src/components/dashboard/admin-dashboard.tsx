"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isPaidEnoughToConfirm } from "@/lib/booking-logic";
import { getDemoBookings, updateDemoBooking } from "@/lib/demo-bookings";
import { nightsBetween, rooms, sampleBookings } from "@/lib/resort-data";
import { hasSupabaseEnv } from "@/lib/supabase-browser";
import type { Booking, BookingStatus, PaymentStatus, Room } from "@/lib/types";

type BookingAction = "approve" | "cancel";
type PaymentAction = "verify" | "refund";
type PaymentDetails = {
  note: string;
  amountPaid: number;
  proofUrl: string;
  proofName: string;
};
type RefundDetails = {
  amount: number;
  reason: string;
};

const defaultAmenityOptions = [
  "Air conditioning",
  "Private bath",
  "Porch",
  "Beach access",
  "Breakfast available",
  "Family layout",
  "Garden view",
  "Mini fridge",
  "Outdoor seating",
  "Central location",
  "Queen bed",
  "Work nook",
  "Resort access",
  "Event space",
  "Open-air space",
];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatPeso(value: number | undefined) {
  return `Php${(Number.isFinite(value) ? value || 0 : 0).toLocaleString()}`;
}

function parsePaymentDetails(source: Record<string, unknown>) {
  const specialRequests = source.specialRequests || source.special_requests;
  if (!specialRequests || typeof specialRequests !== "string") {
    return {
      paymentNote: String(source.paymentNote || ""),
      paymentAmountPaid: Number(source.paymentAmountPaid || 0),
      paymentProofUrl: String(source.paymentProofUrl || ""),
      paymentProofName: String(source.paymentProofName || ""),
      refundAmount: Number(source.refundAmount || 0),
      refundReason: String(source.refundReason || ""),
    };
  }

  try {
    const parsed = JSON.parse(specialRequests) as Record<string, unknown>;
    return {
      paymentNote: String(parsed.paymentNote || source.paymentNote || ""),
      paymentAmountPaid: Number(parsed.paymentAmountPaid || source.paymentAmountPaid || 0),
      paymentProofUrl: String(parsed.paymentProofUrl || source.paymentProofUrl || ""),
      paymentProofName: String(parsed.paymentProofName || source.paymentProofName || ""),
      refundAmount: Number(parsed.refundAmount || source.refundAmount || 0),
      refundReason: String(parsed.refundReason || source.refundReason || ""),
    };
  } catch {
    return {
      paymentNote: String(source.paymentNote || ""),
      paymentAmountPaid: Number(source.paymentAmountPaid || 0),
      paymentProofUrl: String(source.paymentProofUrl || ""),
      paymentProofName: String(source.paymentProofName || ""),
      refundAmount: Number(source.refundAmount || 0),
      refundReason: String(source.refundReason || ""),
    };
  }
}

function normalizeBooking(row: Booking | Record<string, unknown>): Booking {
  const source = row as Record<string, unknown>;
  const room = source.rooms as { name?: string } | undefined;
  const paymentDetails = parsePaymentDetails(source);

  return {
    id: String(source.id || source.booking_number || ""),
    roomId: String(source.roomId || source.room_id || ""),
    roomName: String(source.roomName || room?.name || "Cottage"),
    guestName: String(source.guestName || source.guest_name || ""),
    guestEmail: String(source.guestEmail || source.guest_email || ""),
    guestPhone: String(source.guestPhone || source.guest_phone || ""),
    checkIn: String(source.checkIn || source.check_in || ""),
    checkOut: String(source.checkOut || source.check_out || ""),
    guests: Number(source.guests || source.guest_count || 1),
    totalPrice: Number(source.totalPrice ?? source.total_amount ?? 0),
    status: (source.status || "pending") as BookingStatus,
    paymentStatus: (source.paymentStatus || source.payment_status || "unpaid") as PaymentStatus,
    paymentNote: paymentDetails.paymentNote,
    paymentAmountPaid: paymentDetails.paymentAmountPaid,
    paymentProofUrl: paymentDetails.paymentProofUrl,
    paymentProofName: paymentDetails.paymentProofName,
    refundAmount: paymentDetails.refundAmount,
    refundReason: paymentDetails.refundReason,
    createdAt: String(source.createdAt || source.created_at || new Date().toISOString()).slice(0, 10),
  };
}

export function AdminDashboard() {
  const [bookings, setBookings] = useState(sampleBookings);
  const [cottages, setCottages] = useState(rooms);

  useEffect(() => {
    const supabaseConfigured = hasSupabaseEnv();

    const syncBookings = () => {
      if (!supabaseConfigured) {
        setBookings(getDemoBookings().map(normalizeBooking));
      }

      fetch("/api/admin/bookings")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((rows: Array<Booking | Record<string, unknown>>) => {
          const apiBookings = rows.map(normalizeBooking);
          if (supabaseConfigured) {
            setBookings(apiBookings);
            return;
          }

          const localBookings = getDemoBookings().map(normalizeBooking);
          const apiIds = new Set(apiBookings.map((booking) => booking.id));
          setBookings([...apiBookings, ...localBookings.filter((booking) => !apiIds.has(booking.id))]);
        })
        .catch(() => {
          setBookings(getDemoBookings().map(normalizeBooking));
        });
    };

    syncBookings();
    window.addEventListener("bolihon-bookings-updated", syncBookings);

    return () => window.removeEventListener("bolihon-bookings-updated", syncBookings);
  }, []);

  const stats = useMemo(() => {
    const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
    const confirmedBookings = activeBookings.filter((booking) => booking.status === "confirmed");
    const pendingBookings = activeBookings.filter((booking) => booking.status === "pending");
    const totalRevenue = activeBookings
      .filter((booking) => booking.paymentStatus === "paid" || booking.paymentStatus === "deposit_paid")
      .reduce((sum, booking) => sum + (Number.isFinite(booking.totalPrice) ? booking.totalPrice : 0), 0);

    return {
      total: activeBookings.length,
      pending: pendingBookings.length,
      confirmed: confirmedBookings.length,
      revenue: totalRevenue,
      upcoming: confirmedBookings
        .slice()
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .slice(0, 4),
    };
  }, [bookings]);

  function updateBooking(id: string, action: BookingAction) {
    setBookings((current) =>
      current.map((booking) => {
        if (booking.id !== id) return booking;
        if (action === "approve" && !isPaidEnoughToConfirm(booking.paymentStatus)) return booking;

        const status = action === "approve" ? "confirmed" : "cancelled";
        if (!hasSupabaseEnv()) updateDemoBooking(id, { status });
        fetch("/api/admin/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        }).catch(() => undefined);
        return { ...booking, status };
      }),
    );
  }

  function updatePayment(id: string, action: PaymentAction, details?: PaymentDetails | RefundDetails) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === id
          ? (() => {
              const paymentDetails = details && "amountPaid" in details ? details : undefined;
              const refundDetails = details && "amount" in details ? details : undefined;
              const paymentStatus: PaymentStatus =
                action === "verify"
                  ? (paymentDetails?.amountPaid || 0) >= booking.totalPrice
                    ? "paid"
                    : "deposit_paid"
                  : "refunded";
              const updates: Partial<Booking> = {
                paymentStatus,
                paymentNote: action === "verify" ? paymentDetails?.note || "" : booking.paymentNote,
                paymentAmountPaid: action === "verify" ? paymentDetails?.amountPaid || 0 : booking.paymentAmountPaid,
                paymentProofUrl: action === "verify" ? paymentDetails?.proofUrl || "" : booking.paymentProofUrl,
                paymentProofName: action === "verify" ? paymentDetails?.proofName || "" : booking.paymentProofName,
                refundAmount: action === "refund" ? refundDetails?.amount || 0 : booking.refundAmount,
                refundReason: action === "refund" ? refundDetails?.reason || "" : booking.refundReason,
              };
              if (!hasSupabaseEnv()) updateDemoBooking(id, updates);
              fetch("/api/admin/bookings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id,
                  paymentStatus,
                  paymentNote: updates.paymentNote,
                  paymentAmountPaid: updates.paymentAmountPaid,
                  paymentProofUrl: updates.paymentProofUrl,
                  paymentProofName: updates.paymentProofName,
                  refundAmount: updates.refundAmount,
                  refundReason: updates.refundReason,
                }),
              }).catch(() => undefined);
              return { ...booking, ...updates };
            })()
          : booking,
      ),
    );
  }

  return (
    <div className="grid gap-6">
      <HeroSummary totalRevenue={stats.revenue} upcomingCount={stats.upcoming.length} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total bookings" value={stats.total.toString()} detail="All active requests" tone="cyan" />
        <StatCard label="Pending bookings" value={stats.pending.toString()} detail="Need approval" tone="amber" />
        <StatCard label="Confirmed bookings" value={stats.confirmed.toString()} detail="Arrivals scheduled" tone="emerald" />
        <StatCard label="Total revenue" value={formatPeso(stats.revenue)} detail="Paid and deposits" tone="coral" />
      </section>

      <section className="grid gap-6">
        <CalendarView bookings={bookings} />
      </section>

      <section className="grid gap-6">
        <BookingQueue bookings={bookings} onAction={updateBooking} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <UpcomingCheckIns bookings={stats.upcoming} />
        <RecentPayments bookings={bookings} onAction={updatePayment} />
      </section>

      <CottageManagement cottages={cottages} onUpdate={setCottages} />
      <RoomAvailability cottages={cottages} bookings={bookings} />
    </div>
  );
}

function HeroSummary({
  totalRevenue,
  upcomingCount,
}: {
  totalRevenue: number;
  upcomingCount: number;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-xl shadow-cyan-950/15">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_320px] md:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-100">Admin dashboard</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Resort operations command center</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Monitor reservations, verify payments, approve booking requests, and keep cottage
            availability visible across every screen size.
          </p>
        </div>
        <div className="grid content-end gap-3 rounded-lg bg-white/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Revenue tracked</span>
            <span className="text-2xl font-bold">{formatPeso(totalRevenue)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-3/4 rounded-full bg-coral" />
          </div>
          <p className="text-sm text-slate-300">{upcomingCount} confirmed check-ins on deck</p>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "amber" | "emerald" | "coral";
}) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-800",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
    coral: "bg-rose-50 text-rose-700",
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${tones[tone]}`}>
        {label}
      </div>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

function BookingQueue({
  bookings,
  onAction,
}: {
  bookings: Booking[];
  onAction: (id: string, action: BookingAction) => void;
}) {
  const pending = bookings.filter((booking) => booking.status === "pending");

  return (
    <Panel title="Booking approvals" eyebrow="Requests">
      <div className="grid gap-3">
        {pending.map((booking) => (
          <article key={booking.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <BookingIdentity booking={booking} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => onAction(booking.id, "approve")}
                  disabled={!isPaidEnoughToConfirm(booking.paymentStatus)}
                  className="rounded-full bg-cyan-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  title={
                    isPaidEnoughToConfirm(booking.paymentStatus)
                      ? "Confirm booking"
                      : "Verify payment before confirming this booking"
                  }
                >
                  Confirm after payment
                </button>
                <button
                  onClick={() => onAction(booking.id, "cancel")}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                >
                  Decline
                </button>
              </div>
            </div>
            {!isPaidEnoughToConfirm(booking.paymentStatus) ? (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Payment must be verified before this booking can be confirmed.
              </p>
            ) : null}
          </article>
        ))}
        {pending.length === 0 ? <EmptyState text="No booking approvals waiting." /> : null}
      </div>
    </Panel>
  );
}

function CalendarView({ bookings }: { bookings: Booking[] }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth());
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate();
  const firstDay = new Date(visibleYear, visibleMonth, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const calendarDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const yearOptions = Array.from({ length: 11 }, (_, index) => visibleYear - 5 + index);

  function moveMonth(direction: -1 | 1) {
    const next = new Date(visibleYear, visibleMonth + direction, 1);
    setVisibleMonth(next.getMonth());
    setVisibleYear(next.getFullYear());
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Occupancy calendar</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            {monthNames[visibleMonth]} {visibleYear}
          </h2>
        </div>
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-bolihon-green">
            Previous / next month and year
          </p>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-bolihon-green hover:text-bolihon-green"
        >
          Previous
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={visibleMonth}
            onChange={(event) => setVisibleMonth(Number(event.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none ring-bolihon-green focus:ring-2"
          >
            {monthNames.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={visibleYear}
            onChange={(event) => setVisibleYear(Number(event.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none ring-bolihon-green focus:ring-2"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="rounded-full bg-bolihon-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
        >
          Next
        </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {Array.from({ length: mondayOffset }, (_, index) => (
          <div key={`empty-${index}`} className="min-h-16 rounded-md border border-transparent" />
        ))}
        {calendarDays.map((day) => {
          const isoDay = toIsoDate(visibleYear, visibleMonth, day);
          const dayBookings = bookings.filter(
            (booking) =>
              booking.status !== "cancelled" &&
              booking.checkIn <= isoDay &&
              booking.checkOut >= isoDay,
          );

          return (
            <div
              key={day}
              tabIndex={dayBookings.length ? 0 : -1}
              className={`group relative min-h-16 rounded-md border p-2 text-left text-sm ${
                dayBookings.length ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white"
              }`}
            >
              <span className="font-bold text-slate-800">{day}</span>
              {dayBookings.slice(0, 1).map((booking) => (
                <p key={booking.id} className="mt-2 truncate text-xs font-semibold text-cyan-800">
                  {booking.roomName}
                </p>
              ))}
              {dayBookings.length > 1 ? (
                <p className="text-xs text-slate-500">+{dayBookings.length - 1} more</p>
              ) : null}
              {dayBookings.length ? (
                <div className="pointer-events-none absolute left-2 top-full z-30 mt-2 hidden w-72 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl shadow-slate-950/15 group-hover:block group-focus:block">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                    Booked cottages
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-950">
                    {monthNames[visibleMonth]} {day}, {visibleYear}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {dayBookings.map((booking) => (
                      <div key={booking.id} className="rounded-md bg-slate-50 p-3">
                        <p className="font-bold text-slate-950">{booking.roomName}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {booking.guestName} · {booking.guests} guest{booking.guests === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-cyan-800">
                          {booking.checkIn} to {booking.checkOut}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UpcomingCheckIns({ bookings }: { bookings: Booking[] }) {
  return (
    <Panel title="Upcoming check-ins" eyebrow="Front desk">
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <article key={booking.id} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
            <BookingIdentity booking={booking} />
            <div className="text-right">
              <p className="text-sm font-bold text-slate-950">{booking.checkIn.slice(5)}</p>
              <p className="text-xs text-slate-500">{booking.guests} guests</p>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function RecentPayments({
  bookings,
  onAction,
}: {
  bookings: Booking[];
  onAction: (id: string, action: PaymentAction, details?: PaymentDetails | RefundDetails) => void;
}) {
  const recent = bookings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const [verifyingBooking, setVerifyingBooking] = useState<Booking | null>(null);
  const [refundingBooking, setRefundingBooking] = useState<Booking | null>(null);

  return (
    <Panel title="Recent payments" eyebrow="Finance">
      <div className="grid gap-3">
        {recent.map((booking) => (
          <article key={booking.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <BookingIdentity booking={booking} />
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatPeso(booking.totalPrice)}</p>
              {booking.paymentAmountPaid ? (
                <p className="mt-1 text-xs font-bold text-slate-600">
                  {booking.paymentAmountPaid >= booking.totalPrice ? "Full payment" : "Partial payment"}:{" "}
                  {formatPeso(booking.paymentAmountPaid)}
                </p>
              ) : null}
              {booking.refundAmount ? (
                <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <p className="font-bold">Refunded: {formatPeso(booking.refundAmount)}</p>
                  {booking.refundReason ? <p className="mt-1">{booking.refundReason}</p> : null}
                </div>
              ) : null}
              {booking.paymentNote || booking.paymentProofUrl ? (
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {booking.paymentNote ? <p>{booking.paymentNote}</p> : null}
                  {booking.paymentProofUrl ? (
                    <a
                      href={booking.paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      View proof{booking.paymentProofName ? `: ${booking.paymentProofName}` : ""}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StatusPill status={booking.paymentStatus} />
              {booking.paymentStatus !== "paid" && booking.paymentStatus !== "refunded" ? (
                <button
                  onClick={() => setVerifyingBooking(booking)}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Verify
                </button>
              ) : null}
              {booking.paymentStatus === "paid" || booking.paymentStatus === "deposit_paid" ? (
                <button
                  onClick={() => setRefundingBooking(booking)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Refund
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {verifyingBooking ? (
        <PaymentVerificationDialog
          booking={verifyingBooking}
          onClose={() => setVerifyingBooking(null)}
          onSubmit={(details) => {
            onAction(verifyingBooking.id, "verify", details);
            setVerifyingBooking(null);
          }}
        />
      ) : null}
      {refundingBooking ? (
        <RefundDialog
          booking={refundingBooking}
          onClose={() => setRefundingBooking(null)}
          onSubmit={(details) => {
            onAction(refundingBooking.id, "refund", details);
            setRefundingBooking(null);
          }}
        />
      ) : null}
    </Panel>
  );
}

function RefundDialog({
  booking,
  onClose,
  onSubmit,
}: {
  booking: Booking;
  onClose: () => void;
  onSubmit: (details: RefundDetails) => void;
}) {
  const [amount, setAmount] = useState(String(booking.refundAmount || booking.paymentAmountPaid || booking.totalPrice));
  const [reason, setReason] = useState(booking.refundReason || "");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter the amount refunded.");
      return;
    }

    if (!reason.trim()) {
      setError("Enter the reason for the refund.");
      return;
    }

    onSubmit({
      amount: parsedAmount,
      reason: reason.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Refund payment</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{booking.roomName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {booking.guestName} - paid {formatPeso(booking.paymentAmountPaid || booking.totalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <label htmlFor="refund-amount" className="mt-5 block text-sm font-semibold text-slate-700">
          Amount refunded
        </label>
        <input
          id="refund-amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-rose-600 focus:ring-2"
        />

        <label htmlFor="refund-reason" className="mt-4 block text-sm font-semibold text-slate-700">
          Reason for refund
        </label>
        <textarea
          id="refund-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Example: Guest requested cancellation, duplicate payment, date change"
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-rose-600 focus:ring-2"
        />

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Save refund
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentVerificationDialog({
  booking,
  onClose,
  onSubmit,
}: {
  booking: Booking;
  onClose: () => void;
  onSubmit: (details: PaymentDetails) => void;
}) {
  const [note, setNote] = useState(booking.paymentNote || "");
  const [amountPaid, setAmountPaid] = useState(
    String(booking.paymentAmountPaid || booking.totalPrice || ""),
  );
  const [proofUrl, setProofUrl] = useState(booking.paymentProofUrl || "");
  const [proofName, setProofName] = useState(booking.paymentProofName || "");
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    setCameraLoading(false);
  }

  async function startCamera() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera capture is not available in this browser.");
      return;
    }

    setCameraLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
    } catch {
      setError("Camera permission was blocked or unavailable.");
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet.");
      return;
    }

    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the camera image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const captured = canvas.toDataURL("image/jpeg", 0.8);

    if (captured.length > 1_000_000) {
      setError("Captured image is too large. Move closer and try again.");
      return;
    }

    setProofUrl(captured);
    setProofName(`camera-proof-${new Date().toISOString().slice(0, 10)}.jpg`);
    setError("");
    stopCamera();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) {
      setProofUrl("");
      setProofName("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Upload an image file for the payment proof.");
      event.target.value = "";
      return;
    }

    if (file.size > 750_000) {
      setError("Use an image under 750 KB for now.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProofUrl(typeof reader.result === "string" ? reader.result : "");
      setProofName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amountPaid);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter the amount paid before marking this payment.");
      return;
    }

    onSubmit({
      note: note.trim(),
      amountPaid: parsedAmount,
      proofUrl,
      proofName,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Payment verification</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{booking.roomName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {booking.guestName} - {formatPeso(booking.totalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <label htmlFor="payment-note" className="mt-5 block text-sm font-semibold text-slate-700">
          Payment details
        </label>
        <textarea
          id="payment-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Example: GCash ref 123456, paid Php700 on June 9"
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
        />

        <label htmlFor="payment-amount" className="mt-4 block text-sm font-semibold text-slate-700">
          Amount paid
        </label>
        <input
          id="payment-amount"
          type="number"
          min="0"
          step="0.01"
          value={amountPaid}
          onChange={(event) => setAmountPaid(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
        />
        {Number(amountPaid) > 0 ? (
          <p className="mt-2 rounded-md bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">
            {Number(amountPaid) >= booking.totalPrice ? "Full payment" : "Partial payment"}
          </p>
        ) : null}

        <label htmlFor="payment-proof" className="mt-4 block text-sm font-semibold text-slate-700">
          Proof of payment image
        </label>
        <input
          id="payment-proof"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
        />
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={cameraLoading}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-200"
            >
              {cameraActive ? "Stop camera" : cameraLoading ? "Opening camera..." : "Use camera"}
            </button>
            {cameraActive ? (
              <button
                type="button"
                onClick={capturePhoto}
                className="rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                Capture photo
              </button>
            ) : null}
          </div>
          <video
            ref={videoRef}
            muted
            playsInline
            className={`mt-3 aspect-video w-full rounded-md bg-slate-900 object-cover ${cameraActive ? "block" : "hidden"}`}
          />
          {proofUrl ? (
            <img
              src={proofUrl}
              alt="Payment proof preview"
              className="mt-3 max-h-48 w-full rounded-md border border-slate-200 object-contain"
            />
          ) : null}
        </div>
        {proofName ? <p className="mt-2 text-xs font-semibold text-slate-600">{proofName}</p> : null}
        {error ? <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={Boolean(error)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Save and mark paid
          </button>
        </div>
      </form>
    </div>
  );
}

function CottageManagement({
  cottages,
  onUpdate,
}: {
  cottages: Room[];
  onUpdate: React.Dispatch<React.SetStateAction<Room[]>>;
}) {
  const [selectedId, setSelectedId] = useState(cottages[0]?.id || "");
  const [newAmenity, setNewAmenity] = useState("");
  const selected = cottages.find((cottage) => cottage.id === selectedId) || cottages[0];
  const amenityOptions = Array.from(
    new Set([...defaultAmenityOptions, ...cottages.flatMap((cottage) => cottage.amenities)]),
  ).sort((a, b) => a.localeCompare(b));

  function updateSelected(updates: Partial<Room>) {
    onUpdate((current) =>
      current.map((cottage) => (cottage.id === selected.id ? { ...cottage, ...updates } : cottage)),
    );
  }

  function toggleAmenity(amenity: string) {
    const current = selected.amenities || [];
    updateSelected({
      amenities: current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    });
  }

  function addAmenity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amenity = newAmenity.trim();
    if (!amenity) return;

    updateSelected({
      amenities: Array.from(new Set([...(selected.amenities || []), amenity])),
    });
    setNewAmenity("");
  }

  function deleteAmenity(amenity: string) {
    updateSelected({
      amenities: (selected.amenities || []).filter((item) => item !== amenity),
    });
  }

  if (!selected) return null;

  return (
    <Panel title="Cottage details editor" eyebrow="Inventory admin">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div>
          <label htmlFor="cottageSelect" className="text-sm font-semibold text-slate-700">
            Select cottage
          </label>
          <select
            id="cottageSelect"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
          >
            {cottages.map((cottage) => (
              <option key={cottage.id} value={cottage.id}>
                {cottage.name} - Php{cottage.pricePerNight.toLocaleString()}/day
              </option>
            ))}
          </select>

          <img
            src={selected.image}
            alt={selected.name}
            className="mt-4 h-56 w-full rounded-lg bg-cyan-50 object-cover"
            loading="lazy"
            decoding="async"
          />
          <p className="mt-3 text-sm text-slate-500">
            Changes are applied to this admin session. Connect Supabase for permanent cottage updates.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EditField label="Cottage name" value={selected.name} onChange={(name) => updateSelected({ name })} />
          <EditField
            label="Daily rate"
            type="number"
            value={String(selected.pricePerNight)}
            onChange={(value) => updateSelected({ pricePerNight: Number(value) || 0 })}
          />
          <EditField
            label="Max guests"
            type="number"
            value={String(selected.maxGuests)}
            onChange={(value) => updateSelected({ maxGuests: Number(value) || 1 })}
          />
          <EditField label="Size" value={selected.size} onChange={(size) => updateSelected({ size })} />
          <div className="sm:col-span-2">
            <EditField label="Image URL" value={selected.image} onChange={(image) => updateSelected({ image })} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="description">
              Short details
            </label>
            <textarea
              id="description"
              value={selected.description}
              onChange={(event) => updateSelected({ description: event.target.value })}
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
            />
          </div>
          <label className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={selected.available ?? true}
              onChange={(event) => updateSelected({ available: event.target.checked })}
              className="mt-0.5 h-4 w-4"
            />
            Available for booking
          </label>
          <div className="sm:col-span-2">
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-700">Amenities</p>
              <p className="mt-1 text-sm text-slate-500">
                Check amenities for this cottage. Added amenities are checked automatically.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {amenityOptions.map((amenity) => {
                const checked = selected.amenities.includes(amenity);
                return (
                  <div
                    key={amenity}
                    className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                      checked ? "border-lime-200 bg-lime-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 items-start gap-2 font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAmenity(amenity)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span className="truncate">{amenity}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteAmenity(amenity)}
                      className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
            <form onSubmit={addAmenity} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={newAmenity}
                onChange={(event) => setNewAmenity(event.target.value)}
                placeholder="Add new amenity"
                className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none ring-cyan-600 focus:ring-2"
              />
              <button className="rounded-full bg-bolihon-green px-5 py-2 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark">
                Add amenity
              </button>
            </form>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function EditField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

function RoomAvailability({ cottages, bookings }: { cottages: Room[]; bookings: Booking[] }) {
  return (
    <Panel title="Cottage availability status" eyebrow="Inventory">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cottages.map((room) => (
          <RoomAvailabilityCard key={room.id} room={room} bookings={bookings} />
        ))}
      </div>
    </Panel>
  );
}

function RoomAvailabilityCard({ room, bookings }: { room: Room; bookings: Booking[] }) {
  const nextBooking = bookings
    .filter((booking) => booking.roomId === room.id && booking.status !== "cancelled")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const occupiedNights = bookings
    .filter((booking) => booking.roomId === room.id && booking.status !== "cancelled")
    .reduce((sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut), 0);
  const occupancy = Math.min(100, Math.round((occupiedNights / 31) * 100));
  const status = room.available === false ? "Offline" : nextBooking ? "Reserved" : "Available";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <img
        src={room.image}
        alt={room.name}
        className="h-28 w-full rounded-md bg-cyan-50 object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{room.name}</h3>
          <p className="text-sm text-slate-500">{room.maxGuests} guests, {room.bedrooms} bedrooms</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${room.available === false ? "bg-slate-100 text-slate-600" : nextBooking ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
          {status}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Month occupancy</span>
          <span>{occupancy}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-cyan-700" style={{ width: `${occupancy}%` }} />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        {room.available === false
          ? "Hidden from booking"
          : nextBooking
            ? `Next: ${nextBooking.checkIn} with ${nextBooking.guestName}`
            : "Open for immediate booking"}
      </p>
    </article>
  );
}

function BookingIdentity({ booking }: { booking: Booking }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-950">{booking.id} - {booking.roomName}</p>
      <p className="mt-1 truncate text-sm text-slate-600">
        {booking.guestName} - {booking.guestPhone || "No cellphone"}{booking.guestEmail ? ` - ${booking.guestEmail}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">{booking.checkIn} to {booking.checkOut}</p>
    </div>
  );
}

function StatusPill({ status }: { status: BookingStatus | PaymentStatus }) {
  const label = status.replace("_", " ");
  const tone =
    status === "confirmed" || status === "paid"
      ? "bg-emerald-50 text-emerald-800"
      : status === "pending" || status === "deposit_paid" || status === "authorized"
        ? "bg-amber-50 text-amber-800"
        : status === "cancelled" || status === "refunded"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-bold capitalize ${tone}`}>
      {label}
    </span>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

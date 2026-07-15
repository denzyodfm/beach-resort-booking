"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isPaidEnoughToConfirm } from "@/lib/booking-logic";
import { AutoReplyKnowledgeManager } from "@/components/dashboard/auto-reply-knowledge-manager";
import type { BookingBlockedDate } from "@/lib/booking-blocked-dates";
import { getDemoBookings, updateDemoBooking } from "@/lib/demo-bookings";
import { useDemoAuth } from "@/lib/demo-auth";
import { nightsBetween, rooms, sampleBookings } from "@/lib/resort-data";
import { hasSupabaseEnv } from "@/lib/supabase-browser";
import type { Booking, BookingStatus, CottageCategory, PaymentLog, PaymentStatus, Review, Room } from "@/lib/types";

type BookingAction = "approve" | "cancel";
type PaymentAction = "verify" | "refund";
type PaymentDetails = {
  note: string;
  amountPaid: number;
  proofUrl: string;
  proofName: string;
  paidBy: string;
};
type RefundDetails = {
  amount: number;
  reason: string;
};
type ManagedRole = "guest" | "staff" | "admin";
type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: ManagedRole;
  disabled: boolean;
  emailConfirmed: boolean;
  lastSignInAt: string;
  createdAt: string;
};
type UserFormState = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: ManagedRole;
  password: string;
  disabled: boolean;
};
type CottageCatalogResponse = {
  rooms: Room[];
  categories: CottageCategory[];
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

function getRemainingBalance(booking: Booking) {
  return Math.max(0, booking.totalPrice - (booking.paymentAmountPaid || 0));
}

function normalizePaymentHistory(value: unknown): PaymentLog[] {
  return Array.isArray(value)
    ? value
        .map((item) => item as Partial<PaymentLog>)
        .filter((item) => item.type === "payment" || item.type === "refund")
        .map((item, index) => ({
          id: String(item.id || `payment-log-${index}`),
          type: item.type as "payment" | "refund",
          amount: Number(item.amount || 0),
          note: String(item.note || ""),
          proofName: item.proofName ? String(item.proofName) : "",
          paidBy: item.paidBy ? String(item.paidBy) : "",
          actorName: String(item.actorName || "Unknown user"),
          actorRole: String(item.actorRole || "staff"),
          createdAt: String(item.createdAt || new Date().toISOString()),
          balanceAfter: Number(item.balanceAfter || 0),
        }))
    : [];
}

function parsePaymentDetails(source: Record<string, unknown>) {
  const specialRequests = source.specialRequests || source.special_requests;
  if (!specialRequests || typeof specialRequests !== "string") {
    return {
      paymentNote: String(source.paymentNote || ""),
      paymentAmountPaid: Number(source.paymentAmountPaid || 0),
      paymentProofUrl: String(source.paymentProofUrl || ""),
      paymentProofName: String(source.paymentProofName || ""),
      paymentHistory: normalizePaymentHistory(source.paymentHistory),
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
      paymentHistory: normalizePaymentHistory(parsed.paymentHistory || source.paymentHistory),
      refundAmount: Number(parsed.refundAmount || source.refundAmount || 0),
      refundReason: String(parsed.refundReason || source.refundReason || ""),
    };
  } catch {
    return {
      paymentNote: String(source.paymentNote || ""),
      paymentAmountPaid: Number(source.paymentAmountPaid || 0),
      paymentProofUrl: String(source.paymentProofUrl || ""),
      paymentProofName: String(source.paymentProofName || ""),
      paymentHistory: normalizePaymentHistory(source.paymentHistory),
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
    paymentHistory: paymentDetails.paymentHistory,
    refundAmount: paymentDetails.refundAmount,
    refundReason: paymentDetails.refundReason,
    createdAt: String(source.createdAt || source.created_at || new Date().toISOString()).slice(0, 10),
  };
}

export function AdminDashboard() {
  const { user } = useDemoAuth();
  const [bookings, setBookings] = useState(sampleBookings);
  const [cottages, setCottages] = useState(rooms);
  const [categories, setCategories] = useState<CottageCategory[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

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

  useEffect(() => {
    void loadCatalog();
    void loadReviews();
  }, []);

  async function loadCatalog() {
    try {
      const response = await fetch("/api/admin/rooms");
      const data = (await response.json()) as CottageCatalogResponse | Room[];
      if (!response.ok) throw new Error("Unable to load cottages.");

      if (Array.isArray(data)) {
        setCottages(data);
        setCategories(Array.from(new Set(data.map((room) => room.categoryId || room.type))).map((id) => ({
          id,
          name: data.find((room) => (room.categoryId || room.type) === id)?.categoryName || id,
          description: "",
          sortOrder: 0,
        })));
        return;
      }

      setCottages(data.rooms);
      setCategories(data.categories);
    } catch {
      setCottages(rooms);
      setCategories(Array.from(new Set(rooms.map((room) => room.categoryId))).map((id) => ({
        id,
        name: rooms.find((room) => room.categoryId === id)?.categoryName || id,
        description: "",
        sortOrder: 0,
      })));
    }
  }

  async function loadReviews() {
    try {
      const response = await fetch("/api/admin/reviews");
      const data = (await response.json()) as Review[];
      if (!response.ok) throw new Error("Unable to load reviews.");
      setReviews(data);
    } catch {
      setReviews([]);
    }
  }

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
              const now = new Date().toISOString();
              const actorName = user?.name || user?.email || "Unknown user";
              const actorRole = user?.role || "staff";
              const nextPaid =
                action === "verify"
                  ? Math.min(booking.totalPrice, (booking.paymentAmountPaid || 0) + (paymentDetails?.amountPaid || 0))
                  : booking.paymentAmountPaid || 0;
              const paymentStatus: PaymentStatus =
                action === "verify"
                  ? nextPaid >= booking.totalPrice
                    ? "paid"
                    : "deposit_paid"
                  : "refunded";
              const paymentLog: PaymentLog | null =
                action === "verify" && paymentDetails
                  ? {
                      id: `PAY-${Date.now()}`,
                      type: "payment",
                      amount: paymentDetails.amountPaid,
                      note: paymentDetails.note,
                      proofName: paymentDetails.proofName,
                      paidBy: paymentDetails.paidBy,
                      actorName,
                      actorRole,
                      createdAt: now,
                      balanceAfter: Math.max(0, booking.totalPrice - nextPaid),
                    }
                  : action === "refund" && refundDetails
                    ? {
                        id: `REF-${Date.now()}`,
                        type: "refund",
                        amount: refundDetails.amount,
                        note: refundDetails.reason,
                        actorName,
                        actorRole,
                        createdAt: now,
                      }
                    : null;
              const updates: Partial<Booking> = {
                paymentStatus,
                paymentNote: action === "verify" ? paymentDetails?.note || "" : booking.paymentNote,
                paymentAmountPaid: nextPaid,
                paymentProofUrl: action === "verify" ? paymentDetails?.proofUrl || "" : booking.paymentProofUrl,
                paymentProofName: action === "verify" ? paymentDetails?.proofName || "" : booking.paymentProofName,
                paymentHistory: paymentLog ? [...(booking.paymentHistory || []), paymentLog] : booking.paymentHistory || [],
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
                  paymentHistory: updates.paymentHistory,
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

      {user?.role === "admin" ? <UserAdministration /> : null}

      {user?.role === "admin" ? <AutoReplyKnowledgeManager /> : null}

      <HolidayDateManagement />

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

      <ReviewModeration reviews={reviews} onUpdate={setReviews} />
      <CottageManagement
        cottages={cottages}
        categories={categories}
        onUpdate={setCottages}
        onCategoriesUpdate={setCategories}
        onReload={loadCatalog}
      />
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

function emptyUserForm(): UserFormState {
  return {
    id: "",
    email: "",
    fullName: "",
    phone: "",
    role: "staff",
    password: "",
    disabled: false,
  };
}

function UserAdministration() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<UserFormState>(() => emptyUserForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const editing = Boolean(form.id);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load users.");
      setUsers(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  function editUser(user: ManagedUser) {
    setForm({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      password: "",
      disabled: user.disabled,
    });
    setMessage("");
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save user.");

      setForm(emptyUserForm());
      setMessage(editing ? "User updated." : "User created.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`Delete ${user.email}? This removes the Supabase Auth user.`)) return;

    setMessage("");
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete user.");

      if (form.id === user.id) setForm(emptyUserForm());
      setMessage("User deleted.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete user.");
    }
  }

  function updateForm(updates: Partial<UserFormState>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  return (
    <Panel title="User administration" eyebrow="Admin only">
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={saveUser} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <h3 className="font-bold text-slate-950">{editing ? "Edit user" : "Add user"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Admins can create accounts, update privileges, disable sign-in, or remove users.
            </p>
          </div>

          <EditField label="Full name" value={form.fullName} onChange={(fullName) => updateForm({ fullName })} />
          <EditField label="Email" type="email" value={form.email} onChange={(email) => updateForm({ email })} />
          <EditField label="Phone" value={form.phone} onChange={(phone) => updateForm({ phone })} />
          <EditField
            label={editing ? "New password (optional)" : "Password"}
            type="password"
            value={form.password}
            onChange={(password) => updateForm({ password })}
          />

          <div>
            <label htmlFor="managed-role" className="text-sm font-semibold text-slate-700">
              Privileges
            </label>
            <select
              id="managed-role"
              value={form.role}
              onChange={(event) => updateForm({ role: event.target.value as ManagedRole })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
            >
              <option value="guest">Guest</option>
              <option value="staff">Staff - manage operations</option>
              <option value="admin">Admin - manage users and operations</option>
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.disabled}
              onChange={(event) => updateForm({ disabled: event.target.checked })}
              className="mt-0.5 h-4 w-4"
            />
            Disable this user
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              disabled={saving}
              className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Create user"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => setForm(emptyUserForm())}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {message ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p> : null}
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h3 className="font-bold text-slate-950">Users and privileges</h3>
              <p className="mt-1 text-sm text-slate-500">Staff can manage resort operations. Only admins can manage users.</p>
            </div>
            <button
              type="button"
              onClick={loadUsers}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {users.map((user) => (
              <article key={user.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-950">{user.fullName || user.email}</h4>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold capitalize text-cyan-800">
                      {user.role}
                    </span>
                    {user.disabled ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Disabled</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user.phone || "No phone"} - {user.emailConfirmed ? "Email confirmed" : "Email not confirmed"}
                    {user.lastSignInAt ? ` - Last sign-in ${new Date(user.lastSignInAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => editUser(user)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUser(user)}
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {loading ? <EmptyState text="Loading users..." /> : null}
            {!loading && users.length === 0 ? <EmptyState text="No users found." /> : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function HolidayDateManagement() {
  const [dates, setDates] = useState<BookingBlockedDate[]>([]);
  const [form, setForm] = useState({ date: "", label: "Philippine holiday" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadDates();
  }, []);

  async function loadDates() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/booking-blocked-dates");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load holiday dates.");
      setDates(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load holiday dates.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.date) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/booking-blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save holiday date.");
      setDates((current) => [data, ...current.filter((item) => item.date !== data.date)].sort((a, b) => a.date.localeCompare(b.date)));
      setForm({ date: "", label: "Philippine holiday" });
      setMessage("Holiday date saved. Bookings are disabled for this date.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save holiday date.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDate(date: BookingBlockedDate) {
    if (!window.confirm(`Allow bookings again on ${date.date}?`)) return;

    setMessage("");
    setDates((current) => current.filter((item) => item.id !== date.id));

    try {
      const response = await fetch(`/api/admin/booking-blocked-dates?id=${encodeURIComponent(date.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete holiday date.");
      setMessage("Holiday date removed.");
    } catch (error) {
      setDates((current) => [...current, date].sort((a, b) => a.date.localeCompare(b.date)));
      setMessage(error instanceof Error ? error.message : "Unable to delete holiday date.");
    }
  }

  return (
    <Panel title="No-booking dates" eyebrow="Booking rules">
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={saveDate} className="grid gap-4 rounded-lg bg-slate-50 p-4">
          <div>
            <h3 className="font-bold text-slate-950">Philippine holiday</h3>
            <p className="mt-1 text-sm text-slate-500">
              Saturdays and Sundays are blocked automatically. Add Philippine holidays here to block them too.
            </p>
          </div>
          <EditField label="Holiday date" type="date" value={form.date} onChange={(date) => setForm((current) => ({ ...current, date }))} />
          <EditField label="Holiday name" value={form.label} onChange={(label) => setForm((current) => ({ ...current, label }))} />
          <button
            disabled={saving || !form.date}
            className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Saving..." : "Add no-booking date"}
          </button>
          {message ? <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{message}</p> : null}
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Blocked holiday dates</p>
            <button
              type="button"
              onClick={() => void loadDates()}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
          <div className="grid gap-2">
            {dates.map((date) => (
              <article key={date.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950">{date.date}</p>
                  <p className="text-sm text-slate-500">{date.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteDate(date)}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              </article>
            ))}
            {loading ? <EmptyState text="Loading holiday dates..." /> : null}
            {!loading && dates.length === 0 ? <EmptyState text="No holiday dates added yet." /> : null}
          </div>
        </div>
      </div>
    </Panel>
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
              {(() => {
                const remainingBalance = getRemainingBalance(booking);
                return (
                  <>
              <BookingIdentity booking={booking} />
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatPeso(booking.totalPrice)}</p>
              {booking.paymentAmountPaid ? (
                <p className="mt-1 text-xs font-bold text-slate-600">
                  {booking.paymentAmountPaid >= booking.totalPrice ? "Full payment" : "Partial payment"}:{" "}
                  {formatPeso(booking.paymentAmountPaid)}
                </p>
              ) : null}
              {remainingBalance > 0 && booking.paymentAmountPaid ? (
                <p className="mt-1 text-xs font-bold text-amber-700">Remaining balance: {formatPeso(remainingBalance)}</p>
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
              {booking.paymentHistory?.length ? (
                <div className="mt-3 grid gap-2 rounded-md bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                  <p className="font-bold">Payment log</p>
                  {booking.paymentHistory.slice(-3).map((entry) => (
                    <div key={entry.id} className="border-t border-cyan-100 pt-2 first:border-t-0 first:pt-0">
                      <p className="font-semibold">
                        {entry.type === "payment" ? "Paid" : "Refunded"} {formatPeso(entry.amount)}
                        {entry.paidBy ? ` by ${entry.paidBy}` : ""}
                      </p>
                      <p>
                        {entry.type === "payment" ? "Verified" : "Recorded"} by {entry.actorName} ({entry.actorRole}) on{" "}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.balanceAfter ? <p>Balance after: {formatPeso(entry.balanceAfter)}</p> : null}
                      {entry.note ? <p>{entry.note}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
                  </>
                );
              })()}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StatusPill status={booking.paymentStatus} />
              {booking.paymentStatus !== "paid" && booking.paymentStatus !== "refunded" ? (
                <button
                  onClick={() => setVerifyingBooking(booking)}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {booking.paymentStatus === "deposit_paid" ? "Pay balance" : "Verify"}
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
  const remainingBalance = getRemainingBalance(booking);
  const suggestedAmount = remainingBalance || booking.totalPrice;
  const [note, setNote] = useState(booking.paymentNote || "");
  const [amountPaid, setAmountPaid] = useState(String(suggestedAmount || ""));
  const [paidBy, setPaidBy] = useState(booking.guestName || "");
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

    if (remainingBalance > 0 && parsedAmount > remainingBalance) {
      setError(`Amount exceeds the remaining balance of ${formatPeso(remainingBalance)}.`);
      return;
    }

    onSubmit({
      note: note.trim(),
      amountPaid: parsedAmount,
      paidBy: paidBy.trim() || booking.guestName,
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
            {booking.paymentAmountPaid ? (
              <p className="mt-1 text-sm font-semibold text-amber-700">
                Paid {formatPeso(booking.paymentAmountPaid)} - balance {formatPeso(remainingBalance)}
              </p>
            ) : null}
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

        <label htmlFor="payment-by" className="mt-4 block text-sm font-semibold text-slate-700">
          Paid by
        </label>
        <input
          id="payment-by"
          value={paidBy}
          onChange={(event) => setPaidBy(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
        />

        <label htmlFor="payment-amount" className="mt-4 block text-sm font-semibold text-slate-700">
          {remainingBalance > 0 ? "Amount to apply" : "Amount paid"}
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
            {Number(amountPaid) >= remainingBalance ? "Balance will be paid" : "Deposit / partial payment"}
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

function ReviewModeration({
  reviews,
  onUpdate,
}: {
  reviews: Review[];
  onUpdate: React.Dispatch<React.SetStateAction<Review[]>>;
}) {
  const pending = reviews.filter((review) => review.status === "pending");
  const published = reviews.filter((review) => review.status === "published");
  const [message, setMessage] = useState("");

  async function updateReview(id: string, status: Review["status"]) {
    setMessage("");
    onUpdate((current) => current.map((review) => (review.id === id ? { ...review, status } : review)));

    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update review.");
      onUpdate((current) => current.map((review) => (review.id === id ? data : review)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update review.");
    }
  }

  async function deleteReview(id: string) {
    if (!window.confirm("Delete this review?")) return;

    setMessage("");
    const previous = reviews;
    onUpdate((current) => current.filter((review) => review.id !== id));

    try {
      const response = await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete review.");
    } catch (error) {
      onUpdate(previous);
      setMessage(error instanceof Error ? error.message : "Unable to delete review.");
    }
  }

  return (
    <Panel title="Review approvals" eyebrow="Guest feedback">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Pending approval</h3>
          <div className="mt-3 grid gap-3">
            {pending.map((review) => (
              <ReviewAdminCard
                key={review.id}
                review={review}
                primaryLabel="Approve"
                onPrimary={() => updateReview(review.id, "published")}
                onDelete={() => deleteReview(review.id)}
              />
            ))}
            {pending.length === 0 ? <EmptyState text="No reviews waiting for approval." /> : null}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Published</h3>
          <div className="mt-3 grid gap-3">
            {published.slice(0, 4).map((review) => (
              <ReviewAdminCard
                key={review.id}
                review={review}
                primaryLabel="Unpublish"
                onPrimary={() => updateReview(review.id, "pending")}
                onDelete={() => deleteReview(review.id)}
              />
            ))}
            {published.length === 0 ? <EmptyState text="No published reviews yet." /> : null}
          </div>
        </div>
      </div>
      {message ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
    </Panel>
  );
}

function ReviewAdminCard({
  review,
  primaryLabel,
  onPrimary,
  onDelete,
}: {
  review: Review;
  primaryLabel: string;
  onPrimary: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{review.roomName}</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">{review.rating}/5 stars</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
            review.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {review.status}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{review.title || review.guestName}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{review.body}</p>
      <p className="mt-3 text-xs text-slate-500">
        {review.guestName}{review.guestEmail ? ` - ${review.guestEmail}` : ""}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-full bg-cyan-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function CottageManagement({
  cottages,
  categories,
  onUpdate,
  onCategoriesUpdate,
  onReload,
}: {
  cottages: Room[];
  categories: CottageCategory[];
  onUpdate: React.Dispatch<React.SetStateAction<Room[]>>;
  onCategoriesUpdate: React.Dispatch<React.SetStateAction<CottageCategory[]>>;
  onReload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(cottages[0]?.id || "");
  const [newAmenity, setNewAmenity] = useState("");
  const [newInclude, setNewInclude] = useState("");
  const [message, setMessage] = useState("");
  const [categoryDraft, setCategoryDraft] = useState({ name: "", description: "" });
  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set());
  const selected = cottages.find((cottage) => cottage.id === selectedId) || cottages[0];
  const amenityOptions = Array.from(
    new Set([...defaultAmenityOptions, ...cottages.flatMap((cottage) => cottage.amenities)]),
  ).sort((a, b) => a.localeCompare(b));

  function updateSelected(updates: Partial<Room>) {
    if (!selected) return;
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

  function addInclude(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const include = newInclude.trim();
    if (!include || !selected) return;

    updateSelected({
      bookingIncludes: Array.from(new Set([...(selected.bookingIncludes || []), include])),
    });
    setNewInclude("");
  }

  function deleteInclude(include: string) {
    if (!selected) return;
    updateSelected({
      bookingIncludes: (selected.bookingIncludes || []).filter((item) => item !== include),
    });
  }

  function addCottage() {
    const category = categories[0] || { id: "cove", name: "Cove cottages", description: "", sortOrder: 0 };
    const id = `cottage_${category.id}_${Date.now()}`;
    const nextRoom: Room = {
      id,
      slug: id.replace(/_/g, "-"),
      name: "New cottage",
      type: category.id,
      categoryId: category.id,
      categoryName: category.name,
      description: "Describe this cottage.",
      longDescription: "Add full cottage details.",
      pricePerNight: 0,
      maxGuests: 1,
      bedrooms: 1,
      bathrooms: 1,
      size: "",
      image: selected?.image || "",
      gallery: selected?.gallery || [],
      amenities: [],
      bookingIncludes: ["Guest dashboard visibility after sign in"],
      available: true,
    };

    onUpdate((current) => [nextRoom, ...current]);
    setDraftIds((current) => new Set([...current, id]));
    setSelectedId(id);
    setMessage("New cottage draft added. Save cottage to make it permanent.");
  }

  async function saveCottage() {
    if (!selected) return;
    setMessage("");

    try {
      const response = await fetch("/api/admin/rooms", {
        method: draftIds.has(selected.id) ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save cottage.");
      setDraftIds((current) => {
        const next = new Set(current);
        next.delete(selected.id);
        return next;
      });
      setMessage("Cottage saved.");
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save cottage.");
    }
  }

  async function deleteCottage() {
    if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;
    const previous = cottages;
    onUpdate((current) => current.filter((cottage) => cottage.id !== selected.id));
    setSelectedId(cottages.find((cottage) => cottage.id !== selected.id)?.id || "");

    try {
      const response = await fetch(`/api/admin/rooms?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete cottage.");
      setMessage("Cottage deleted.");
    } catch (error) {
      onUpdate(previous);
      setMessage(error instanceof Error ? error.message : "Unable to delete cottage.");
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryDraft.name.trim();
    if (!name) return;
    const nextCategory: CottageCategory = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      description: categoryDraft.description.trim(),
      sortOrder: categories.length * 10 + 10,
    };

    onCategoriesUpdate((current) => [...current, nextCategory]);
    setCategoryDraft({ name: "", description: "" });

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextCategory),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save category.");
      setMessage("Category saved.");
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save category.");
    }
  }

  async function deleteCategory(categoryId: string) {
    if (cottages.some((cottage) => cottage.categoryId === categoryId)) {
      setMessage("Move or delete cottages in this category first.");
      return;
    }
    if (!window.confirm("Delete this category?")) return;

    onCategoriesUpdate((current) => current.filter((category) => category.id !== categoryId));
    try {
      const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(categoryId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete category.");
      setMessage("Category deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete category.");
    }
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
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={addCottage}
              className="rounded-full bg-bolihon-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
            >
              Add cottage
            </button>
            <button
              type="button"
              onClick={saveCottage}
              className="rounded-full bg-cyan-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
            >
              Save cottage
            </button>
            <button
              type="button"
              onClick={deleteCottage}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Delete cottage
            </button>
          </div>
          {message ? <p className="mt-3 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{message}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EditField label="Cottage name" value={selected.name} onChange={(name) => updateSelected({ name })} />
          <div>
            <label htmlFor="cottageCategory" className="text-sm font-semibold text-slate-700">
              Category
            </label>
            <select
              id="cottageCategory"
              value={selected.categoryId}
              onChange={(event) => {
                const category = categories.find((item) => item.id === event.target.value);
                updateSelected({
                  type: event.target.value,
                  categoryId: event.target.value,
                  categoryName: category?.name || event.target.value,
                });
              }}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
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
              <p className="text-sm font-semibold text-slate-700">Booking includes</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(selected.bookingIncludes || []).map((include) => (
                <div key={include} className="flex items-center justify-between gap-3 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm">
                  <span className="font-medium text-cyan-950">{include}</span>
                  <button
                    type="button"
                    onClick={() => deleteInclude(include)}
                    className="rounded-full border border-cyan-200 px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-white"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addInclude} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={newInclude}
                onChange={(event) => setNewInclude(event.target.value)}
                placeholder="Add booking include"
                className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none ring-cyan-600 focus:ring-2"
              />
              <button className="rounded-full bg-cyan-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800">
                Add include
              </button>
            </form>
          </div>
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
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Categories</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <article key={category.id} className="rounded-lg border border-slate-200 p-4">
              <p className="font-bold text-slate-950">{category.name}</p>
              <p className="mt-1 text-sm text-slate-500">{category.description || "No description"}</p>
              <p className="mt-2 text-xs font-semibold text-cyan-800">
                {cottages.filter((cottage) => cottage.categoryId === category.id).length} cottage(s)
              </p>
              <button
                type="button"
                onClick={() => deleteCategory(category.id)}
                className="mt-3 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Delete category
              </button>
            </article>
          ))}
        </div>
        <form onSubmit={saveCategory} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <EditField
            label="Category name"
            value={categoryDraft.name}
            onChange={(name) => setCategoryDraft((current) => ({ ...current, name }))}
          />
          <EditField
            label="Category description"
            value={categoryDraft.description}
            onChange={(description) => setCategoryDraft((current) => ({ ...current, description }))}
          />
          <button className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark">
            Add category
          </button>
        </form>
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

import { getSessionUser, requireResortManager } from "@/lib/admin-auth";
import { errorMessage, execute, hasDatabaseEnv, queryOne, transaction } from "@/lib/db";
import { isPaidEnoughToConfirm } from "@/lib/booking-logic";
import { resortTimeZone } from "@/lib/booking-settings";
import { fetchBookingRow, fetchBookingRows } from "@/lib/record-queries";
import { expireUnpaidReservations } from "@/lib/reservation-expiry";
import type { PaymentStatus } from "@/lib/types";

/**
 * Front desk (SOP 20261001 walk-in / 20261002 online reservation).
 *
 * GET  ?q=       Search by booking number, guest name or cellphone. Without q,
 *                returns today's arrivals: bookings whose stay includes today.
 * POST action:   "check_in"      mark a paid booking as checked in.
 *                "issue_invoice" give a paid booking the next sales invoice number.
 */
export async function GET(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;
  if (!hasDatabaseEnv()) return Response.json({ message: "The front desk needs the database." }, { status: 503 });

  await expireUnpaidReservations();
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";

  try {
    if (q) {
      const like = `%${q}%`;
      const digits = q.replace(/\D/g, "");
      const rows = await fetchBookingRows(
        `where b.status <> 'cancelled' and (b.booking_number like ? or b.guest_name like ? or b.invoice_number like ?
           ${digits.length >= 4 ? "or replace(replace(replace(b.guest_phone, ' ', ''), '-', ''), '+', '') like ?" : ""})`,
        digits.length >= 4 ? [like, like, like, `%${digits}%`] : [like, like, like],
      );
      return Response.json(rows.slice(0, 50));
    }

    const today = resortToday();
    return Response.json(
      await fetchBookingRows(
        "where b.status in ('pending', 'confirmed', 'checked_in') and b.check_in <= ? and b.check_out >= ?",
        [today, today],
      ),
    );
  } catch (error) {
    return Response.json({ message: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;
  if (!hasDatabaseEnv()) return Response.json({ message: "The front desk needs the database." }, { status: 503 });

  const { action, id } = (await request.json()) as { action?: string; id?: string };
  const booking = id ? await queryOne("select id, status, payment_status, invoice_number, special_requests from bookings where id = ?", [id]) : null;
  if (!booking) return Response.json({ message: "Booking not found." }, { status: 404 });

  if (booking.status === "cancelled") {
    return Response.json({ message: "This booking was cancelled." }, { status: 409 });
  }
  if (!isPaidEnoughToConfirm(booking.payment_status as PaymentStatus)) {
    return Response.json(
      {
        message:
          booking.payment_status === "authorized"
            ? "The guest's payment reference has not been verified yet. Verify it in Admin → Payments first."
            : "No payment is recorded for this booking. Collect payment first.",
      },
      { status: 409 },
    );
  }

  const user = await getSessionUser();
  const actor = user?.fullName || user?.email || "Staff";

  try {
    if (action === "check_in") {
      if (booking.status === "checked_in") return Response.json(await fetchBookingRow(String(booking.id)));
      await execute(
        `update bookings set status = 'checked_in', checked_in_at = utc_timestamp(3), special_requests = ?
          where id = ? and status in ('pending', 'confirmed')`,
        [JSON.stringify({ ...parseDetails(booking.special_requests), checkedInBy: actor }), booking.id],
      );
      return Response.json(await fetchBookingRow(String(booking.id)));
    }

    if (action === "issue_invoice") {
      if (booking.invoice_number) return Response.json(await fetchBookingRow(String(booking.id)));
      // The counter row is locked, so two cashiers never get the same number.
      await transaction(async (connection) => {
        const current = await queryOne("select invoice_number from bookings where id = ? for update", [booking.id], connection);
        if (current?.invoice_number) return;
        const counter = await queryOne("select last_invoice_number from resort_settings where id = 1 for update", [], connection);
        const next = Number(counter?.last_invoice_number || 0) + 1;
        await execute("update resort_settings set last_invoice_number = ? where id = 1", [next], connection);
        const invoiceNumber = `SI-${resortToday().slice(0, 4)}-${String(next).padStart(6, "0")}`;
        await execute("update bookings set invoice_number = ?, special_requests = ? where id = ?", [
          invoiceNumber,
          JSON.stringify({ ...parseDetails(booking.special_requests), invoiceIssuedAt: new Date().toISOString(), invoiceIssuedBy: actor }),
          booking.id,
        ], connection);
      });
      return Response.json(await fetchBookingRow(String(booking.id)));
    }

    return Response.json({ message: "Unsupported front desk action." }, { status: 400 });
  } catch (error) {
    const message = errorMessage(error);
    return Response.json(
      {
        message: message.includes("Unknown column")
          ? "Run node --env-file=.env.local scripts/migrate-online-booking.mjs to add the front desk columns."
          : message,
      },
      { status: 500 },
    );
  }
}

function parseDetails(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { note: String(value || "") };
  }
}

function resortToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: resortTimeZone }).format(new Date());
}

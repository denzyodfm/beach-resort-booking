import Link from "next/link";
import { LogIn } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { isResortManager } from "@/lib/admin-auth";
import { readBookingExtras } from "@/lib/booking-row";
import { formatPeso, resortTimeZone } from "@/lib/booking-settings";
import { hasDatabaseEnv } from "@/lib/db";
import { fetchBookingRow } from "@/lib/record-queries";
import { resortLocation } from "@/lib/resort-location";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales invoice | BOLIHON" };

type PaymentEntry = { type?: string; amount?: number; note?: string; createdAt?: string; actorName?: string };

/** Printable sales invoice for a paid booking (SOP 20261001 step 6). Staff only. */
export default async function InvoicePage(props: PageProps<"/invoice/[id]">) {
  const { id } = await props.params;

  if (!hasDatabaseEnv() || !(await isResortManager())) {
    return (
      <Notice title="Staff sign-in required" body="Sign in as staff or admin to view sales invoices.">
        <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white">
          <LogIn aria-hidden="true" className="h-4 w-4" />
          Go to login
        </Link>
      </Notice>
    );
  }

  const row = await fetchBookingRow(id);
  if (!row) return <Notice title="Booking not found" body="Check the link and try again." />;

  const booking = readBookingExtras(row);
  if (!booking.invoiceNumber) {
    return <Notice title="No invoice yet" body="Issue the sales invoice from the Monitoring Station front desk tab or Admin → Payments." />;
  }

  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(String(row.special_requests || "{}")) || {};
  } catch {
    details = {};
  }
  const total = Number(row.total_amount || 0);
  const amountPaid = Math.min(total, Number(details.paymentAmountPaid) || 0);
  const history = (Array.isArray(details.paymentHistory) ? details.paymentHistory : []) as PaymentEntry[];
  const payments = history.filter((entry) => entry.type === "payment");
  const guests = Number(row.guest_count || 1);
  const roomName = String((row.rooms as { name?: string } | null)?.name || "Cottage");
  const checkIn = String(row.check_in || "");
  const checkOut = String(row.check_out || "");
  const hasBreakdown = booking.cottageSubtotal !== undefined && details.charges !== undefined;
  const lines: Array<[string, number]> = hasBreakdown
    ? [
        [`Accommodation rental: ${roomName} (${checkIn}${checkOut !== checkIn ? ` to ${checkOut}` : ""})`, booking.cottageSubtotal || 0],
        ...entranceLines(booking.party, booking.entranceRates, booking.entranceFeeAmount || 0, guests),
        ["Reservation fee (online booking)", booking.reservationFeeAmount || 0],
        ["Premium booking (chosen cottage)", booking.premiumFeeAmount || 0],
        ["Internet access", booking.internetFeeAmount || 0],
      ].filter((line): line is [string, number] => Number(line[1]) > 0)
    : [[`Accommodation rental: ${roomName} (${checkIn}${checkOut !== checkIn ? ` to ${checkOut}` : ""})`, total]];
  const issuedAt = formatDateTime(String(details.invoiceIssuedAt || new Date().toISOString()));
  const method = booking.paymentReference ? `Online (GCash / bank), ref. ${booking.paymentReference}` : "Cash";

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-6 border-b-2 border-bolihon-green pb-6 sm:flex-row">
          <div>
            <img src="/bolihon-cove-logo.jpg" alt="Bolihon Cove" className="-ml-3 h-16 w-auto" />
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {resortLocation.name}
              <br />
              {resortLocation.streetAddress}
              <br />
              {resortLocation.contactPhone} · FB: {resortLocation.facebookPage}
            </p>
          </div>
          <div className="sm:text-right">
            <h1 className="text-3xl font-bold tracking-wide text-slate-950">SALES INVOICE</h1>
            <p className="mt-2 font-mono text-lg font-bold text-bolihon-green">{booking.invoiceNumber}</p>
            <p className="mt-1 text-sm text-slate-600">Date issued: {issuedAt}</p>
            <p className="text-sm text-slate-600">Booking no.: {booking.bookingNumber}</p>
          </div>
        </header>

        <dl className="grid gap-4 border-b border-slate-200 py-6 text-sm sm:grid-cols-2">
          <Detail label="Sold to" value={String(row.guest_name || "Walk-in guest")} />
          <Detail label="Cellphone" value={String(row.guest_phone || "—")} />
          <Detail label="Stay" value={`${checkIn}${checkOut !== checkIn ? ` to ${checkOut}` : ""} · ${guests} guest${guests === 1 ? "" : "s"}`} />
          <Detail label="Booking type" value={booking.channel === "walk_in" ? "Walk-in" : booking.channel === "online" ? `Online${booking.bookingType ? ` · ${booking.bookingType}` : ""}` : "—"} />
        </dl>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([label, amount]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="py-3 pr-4 text-slate-800">{label}</td>
                <td className="py-3 text-right font-medium tabular-nums text-slate-900">{formatPeso(amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right font-semibold text-slate-700">Total amount due</td>
              <td className="pt-4 text-right text-lg font-bold tabular-nums text-slate-950">{formatPeso(total)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-right text-slate-600">Amount paid</td>
              <td className="pt-1 text-right font-semibold tabular-nums text-slate-900">{formatPeso(amountPaid)}</td>
            </tr>
            <tr>
              <td className="pt-1 text-right text-slate-600">Balance</td>
              <td className="pt-1 text-right font-semibold tabular-nums text-slate-900">{formatPeso(Math.max(0, total - amountPaid))}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 grid gap-6 border-t border-slate-200 pt-6 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-950">Payment</p>
            <p className="mt-1 text-slate-600">{method}</p>
            {payments.map((payment, index) => (
              <p key={index} className="text-slate-500">
                {formatPeso(Number(payment.amount) || 0)} on {formatDateTime(String(payment.createdAt || ""))}
                {payment.actorName ? ` · received by ${payment.actorName}` : ""}
              </p>
            ))}
          </div>
          <div className="sm:text-right">
            <div className="mt-10 border-t border-slate-400 pt-1 sm:ml-auto sm:w-64">
              <p className="font-semibold text-slate-950">{String(details.invoiceIssuedBy || "Guest Services Attendant")}</p>
              <p className="text-xs text-slate-500">Guest Services Attendant</p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">Thank you, and enjoy your stay at Bolihon Cove!</p>
      </article>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
      <p className="mt-3 text-slate-600">{body}</p>
      {children}
    </section>
  );
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", { timeZone: resortTimeZone, dateStyle: "medium", timeStyle: "short" });
}

/** One invoice line per entrance group; older bookings without a mix get a single line. */
function entranceLines(
  party: { regular: number; child: number; senior: number } | undefined,
  rates: { regular: number; child: number; senior: number } | undefined,
  total: number,
  guests: number,
): Array<[string, number]> {
  if (!total) return [];
  if (!party || !rates) return [[`Entrance fee: ${guests} guest${guests === 1 ? "" : "s"} × ${formatPeso(total / guests)}`, total]];
  return [
    [`Entrance fee, regular: ${party.regular} × ${formatPeso(rates.regular)}`, party.regular * rates.regular] as [string, number],
    [`Entrance fee, children: ${party.child} × ${formatPeso(rates.child)}`, party.child * rates.child] as [string, number],
    [`Entrance fee, senior citizen / PWD: ${party.senior} × ${formatPeso(rates.senior)}`, party.senior * rates.senior] as [string, number],
  ].filter(([, amount], index) => [party.regular, party.child, party.senior][index] > 0 && amount >= 0);
}

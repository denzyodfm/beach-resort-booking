import Link from "next/link";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export function MonitoringStation() {
  return (
    <div className="grid gap-8">
      <header className="rounded-2xl bg-slate-950 px-6 py-8 text-white shadow-sm sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">Staff and admin only</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Bolihon Monitoring Station</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Oversee online reservations, coordinate walk-in bookings, and help guests find the resort from one protected workspace.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/booking-by-date" className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-bold text-white transition hover:bg-bolihon-green-dark">
            Record a walk-in booking
          </Link>
          <Link href="/admin" className="rounded-full border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
            Open full admin page
          </Link>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-2 border-b border-slate-200 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Guest directions</p>
          <h2 className="text-2xl font-bold text-slate-950">Interactive resort location map</h2>
          <p className="text-sm text-slate-600">Use the map to show guests the route to Bolihon Beach Resort in Carmen, Agusan del Norte.</p>
        </div>
        <iframe
          title="Bolihon Beach Resort location map"
          src="https://www.google.com/maps?q=Bolihon+Beach+Resort,+Carmen,+Agusan+del+Norte&output=embed"
          className="h-[360px] w-full border-0 sm:h-[440px]"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>

      <section className="grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Reservation control</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Online and walk-in booking management</h2>
        </div>
        <AdminDashboard />
      </section>
    </div>
  );
}

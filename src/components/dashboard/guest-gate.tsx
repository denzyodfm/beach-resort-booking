"use client";

import Link from "next/link";
import { GuestDashboard } from "@/components/dashboard/guest-dashboard";
import { useDemoAuth } from "@/lib/demo-auth";

export function GuestGate() {
  const { user } = useDemoAuth();

  if (user) return <GuestDashboard />;

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Guest dashboard</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Guest login required</h1>
      <p className="mt-3 text-slate-600">
        Sign in as a guest to view your pending bookings, contact info, cancellation options, and chat with admin.
      </p>
      <Link href="/login?role=guest" className="mt-6 inline-flex rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white">
        Go to guest login
      </Link>
    </div>
  );
}

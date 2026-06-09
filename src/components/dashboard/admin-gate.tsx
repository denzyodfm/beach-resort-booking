"use client";

import Link from "next/link";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { useDemoAuth } from "@/lib/demo-auth";

export function AdminGate() {
  const { user } = useDemoAuth();

  if (user?.role === "admin") return <AdminDashboard />;

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Admin access</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Admin login required</h1>
      <p className="mt-3 text-slate-600">
        Sign in as admin to manage bookings, cottage rates, images, payments, availability, and guest messages.
      </p>
      <Link href="/login?role=admin" className="mt-6 inline-flex rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white">
        Go to admin login
      </Link>
    </div>
  );
}

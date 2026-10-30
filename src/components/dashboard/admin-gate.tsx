"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";

export function AdminGate({ children }: { children?: ReactNode }) {
  const { user } = useDemoAuth();

  if (canManageResort(user?.role)) return children ?? <AdminDashboard />;

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">Management access</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Staff or admin login required</h1>
      <p className="mt-3 text-slate-600">Sign in as admin or staff to manage bookings, cottage rates, images, payments, availability, and guest messages.</p>
      <Link href="/login" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white">
        <LogIn aria-hidden="true" className="h-4 w-4 shrink-0" />
        Go to login
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { BolihonLogo } from "@/components/bolihon-logo";
import { useDemoAuth } from "@/lib/demo-auth";

const navItems = [
  { href: "/rooms", label: "Cottages" },
  { href: "/booking", label: "Book" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const { user, logout } = useDemoAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <BolihonLogo href="/" />
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} prefetch className="transition hover:text-bolihon-green">
              {item.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs text-slate-500 sm:block">
              <span className="block font-semibold capitalize text-slate-800">{user.role}</span>
              {user.name}
            </span>
            <button
              onClick={logout}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            prefetch
            className="rounded-full bg-bolihon-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-bolihon-green-dark"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

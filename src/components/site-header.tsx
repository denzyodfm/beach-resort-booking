"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BolihonLogo } from "@/components/bolihon-logo";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";

const publicNavItems = [
  { href: "/rooms", label: "Cottages" },
  { href: "/booking-by-date", label: "Book Here" },
  { href: "/reviews", label: "Reviews" },
];

export function SiteHeader() {
  const { user, logout } = useDemoAuth();
  const pathname = usePathname();
  const navItems = [
    ...publicNavItems,
    ...(user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(canManageResort(user?.role)
      ? [
          { href: "/monitoring", label: "Monitoring Station" },
          { href: "/location-map", label: "Location Map" },
          { href: "/admin", label: "Admin" },
        ]
      : []),
  ];
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/booking-by-date" && pathname === "/booking");

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <BolihonLogo href="/" />
          {user ? (
            <div className="grid min-w-40 gap-2">
              <div className="flex items-center justify-end gap-3">
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
              <Link
                href="/booking-by-date"
                prefetch
                className="rounded-lg bg-bolihon-green px-6 py-3 text-center text-base font-bold text-white shadow-md transition hover:bg-bolihon-green-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bolihon-green"
              >
                Book Here
              </Link>
            </div>
          ) : (
            <Link
              href="/booking-by-date"
              prefetch
              className="rounded-full bg-bolihon-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-bolihon-green-dark"
            >
              Book Here
            </Link>
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700 md:justify-center">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 font-semibold transition ${active ? "bg-bolihon-green text-white shadow-md" : "hover:bg-emerald-50 hover:text-bolihon-green"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

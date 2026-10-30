"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarCheck,
  CreditCard,
  Gauge,
  Home,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Monitor,
  Navigation,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { BolihonLogo } from "@/components/bolihon-logo";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";

type NavItem = { href: string; label: string; icon: LucideIcon };

const publicNavItems: NavItem[] = [
  { href: "/rooms", label: "Cottages", icon: Home },
  { href: "/pay", label: "Pay / Track Booking", icon: CreditCard },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/location", label: "How to Get Here", icon: Navigation },
];

export function SiteHeader() {
  const { user, logout } = useDemoAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const manager = canManageResort(user?.role);
  const accountItems: NavItem[] = [
    ...(user ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    ...(manager
      ? [
          { href: "/monitoring", label: "Monitoring Station", icon: Monitor },
          { href: "/location-map", label: "Location Map", icon: MapPinned },
          { href: "/admin", label: "Admin", icon: Gauge },
        ]
      : []),
  ];
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/booking-by-date" && pathname === "/booking");

  // Close the mobile menu after navigating.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 print:hidden border-b border-emerald-900/10 bg-white/80 shadow-[0_1px_0_rgb(20_35_26/0.04)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <BolihonLogo href="/" />

        <nav aria-label="Main" className="hidden items-center gap-1 rounded-full border border-emerald-900/10 bg-white/70 p-1 shadow-sm lg:flex">
          {publicNavItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <span className="hidden whitespace-nowrap text-right text-xs leading-tight text-slate-500 xl:block">
                <span className="block font-semibold capitalize text-slate-800">{user.role}</span>
                {user.name}
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          ) : null}
          <Link
            href="/booking-by-date"
            prefetch
            aria-current={isActive("/booking-by-date") ? "page" : undefined}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-bolihon-green px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition hover:-translate-y-px hover:bg-bolihon-green-dark hover:shadow-lg sm:px-5"
          >
            <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Book</span>
            <span className="hidden sm:inline">Book Here</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 lg:hidden"
          >
            {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {accountItems.length ? (
        <div className="hidden bg-bolihon-green lg:block">
          <nav aria-label="Staff" className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 sm:px-6 lg:px-8">
            <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cove">{manager ? "Staff" : "Account"}</span>
            {accountItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    active ? "bg-white text-bolihon-green shadow-sm" : "text-emerald-50 hover:bg-white/10"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-emerald-900/10 bg-white lg:hidden">
          <nav aria-label="Mobile" className="mx-auto grid max-w-7xl gap-1 px-4 py-3 sm:px-6">
            {publicNavItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} block />
            ))}
            {accountItems.length ? (
              <>
                <p className="mt-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{manager ? "Staff" : "Account"}</p>
                {accountItems.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item.href)} block />
                ))}
              </>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={logout}
                className="mt-2 inline-flex items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
                Logout ({user.name})
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({ item, active, block = false }: { item: NavItem; active: boolean; block?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={
        block
          ? `inline-flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold transition ${
              active ? "bg-emerald-50 text-bolihon-green" : "text-slate-700 hover:bg-slate-50"
            }`
          : `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              active ? "bg-bolihon-green text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-bolihon-green"
            }`
      }
    >
      <Icon aria-hidden="true" className={block ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
      {item.label}
    </Link>
  );
}

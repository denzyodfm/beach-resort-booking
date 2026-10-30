import Link from "next/link";
import { CalendarCheck, CircleHelp, CreditCard, Facebook, Home, LayoutDashboard, MapPin, Navigation, Phone, Star } from "lucide-react";
import { BolihonLogo } from "@/components/bolihon-logo";
import { getFooterSettings } from "@/lib/footer-settings-server";
import { resortLocation } from "@/lib/resort-location";

const exploreLinks = [
  { href: "/rooms", label: "Cottages", icon: Home },
  { href: "/booking", label: "Reserve stay", icon: CalendarCheck },
  { href: "/pay", label: "Pay / track booking", icon: CreditCard },
  { href: "/reviews", label: "Guest reviews", icon: Star },
  { href: "/dashboard", label: "Guest dashboard", icon: LayoutDashboard },
  { href: "/help", label: "Help", icon: CircleHelp },
];

export async function SiteFooter() {
  const branding = await getFooterSettings();

  return (
    <footer className="relative mt-16 bg-emerald-950 text-white print:hidden">
      {/* Shoreline edge between the page and the footer. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="absolute -top-[59px] left-0 h-[60px] w-full text-emerald-950"
      >
        <path fill="currentColor" d="M0 34c120-18 240-26 360-18s240 30 360 30 240-22 360-30 240-6 360 6v38H0z" />
      </svg>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <BolihonLogo variant="footer" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-100/80">
            Beachfront cottages, open-air pavilions and event halls on the shore of Carmen, Agusan del Norte.
          </p>
        </div>

        <div>
          <p className="font-display text-base font-semibold text-cove">Explore</p>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {exploreLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="inline-flex items-center gap-2 text-emerald-50/85 transition hover:text-white">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cove" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-display text-base font-semibold text-cove">Visit us</p>
          <p className="mt-4 flex gap-2 text-sm leading-6 text-emerald-50/85">
            <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-cove" />
            <span>
              {resortLocation.name}
              <br />
              {resortLocation.streetAddress}
            </span>
          </p>
          <p className="mt-2 flex gap-2 text-sm text-emerald-50/85">
            <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cove" />
            {resortLocation.contactPhone}
          </p>
          <p className="mt-2 flex gap-2 text-sm text-emerald-50/85">
            <Facebook aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cove" />
            FB page: {resortLocation.facebookPage}
          </p>
          <Link href="/location" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline">
            <Navigation aria-hidden="true" className="h-4 w-4 shrink-0 text-cove" />
            How to get here
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="font-display text-lg font-semibold">Ready for the shore?</p>
          <p className="mt-2 text-sm leading-6 text-emerald-50/80">
            Pick a date, choose a cottage and pay online in minutes.
          </p>
          <Link
            href="/booking-by-date"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-cove px-5 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-white"
          >
            <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            Book a cottage
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-emerald-100/60 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} BOLIHON Cove. All rights reserved.
        </p>
      </div>

      <div className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6 lg:px-8">
          <span className="rounded-full border-2 border-blue-900 bg-blue-700 px-4 py-1 text-sm font-bold italic text-white">
            {branding.poweredByLabel}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-4xl font-bold leading-none text-red-700">{branding.companyInitial}</span>
            <span className="font-serif text-sm tracking-wide text-red-700">{branding.companyName}</span>
          </span>
          <span className="text-sm font-semibold text-blue-700">{branding.teamLabel}</span>
        </div>
      </div>
    </footer>
  );
}

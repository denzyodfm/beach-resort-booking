import Link from "next/link";
import { BolihonLogo } from "@/components/bolihon-logo";

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <BolihonLogo variant="footer" />
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            A calm, design-forward resort booking app with Supabase-ready auth, reservations,
            cottages, and admin workflows.
          </p>
        </div>
        <div>
          <p className="font-semibold">Explore</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            <Link href="/rooms">Cottages</Link>
            <Link href="/booking">Reserve stay</Link>
            <Link href="/dashboard">Guest dashboard</Link>
          </div>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            reservations@bolihon.test
            <br />
            +1 808 555 0188
          </p>
        </div>
      </div>
    </footer>
  );
}

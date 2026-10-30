import { Map as MapIcon } from "lucide-react";
import { ResortMap } from "@/components/resort-map";
import { getDirectionsUrl, getRouteEmbedUrl, resortLocation } from "@/lib/resort-location";

export const metadata = {
  title: "How to get here | BOLIHON",
};

export default function LocationPage() {
  const routes = resortLocation.routes.filter((route) => route.steps.length > 0);

  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Location</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">How to get here</h1>
        <p className="mt-3 text-slate-600">
          {resortLocation.name}, {resortLocation.address}. Tap <span className="font-semibold">Get directions</span> to open
          the route in your phone&apos;s map app.
        </p>
      </header>

      <ResortMap />

      <div className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Route from Butuan City</h2>
          <p className="mt-1 text-sm text-slate-600">
            About 38 km along the national highway via Buenavista and Nasipit — roughly 50 minutes by car or motorcycle.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <iframe
            title={`Route from Butuan City to ${resortLocation.name}`}
            src={getRouteEmbedUrl(resortLocation.routeMapOrigin)}
            className="h-[320px] w-full border-0 sm:h-[460px]"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <a
          href={getDirectionsUrl(resortLocation.routeMapOrigin)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <MapIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          Open this route in Google Maps
        </a>
      </div>

      {resortLocation.parkingNote ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-slate-950">Parking and drop-off</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{resortLocation.parkingNote}</p>
        </div>
      ) : null}

      {routes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {routes.map((route) => (
            <div key={route.from} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="font-semibold text-slate-950">From {route.from}</p>
              <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-slate-700">
                {route.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

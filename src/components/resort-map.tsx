import { Map as MapIcon, Navigation } from "lucide-react";
import { getAppleMapsUrl, getDirectionsUrl, getMapEmbedUrl, resortLocation } from "@/lib/resort-location";

export function ResortMap({ heightClass = "h-[320px] sm:h-[460px]" }: { heightClass?: string }) {
  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        <iframe
          title={`${resortLocation.name} location map`}
          src={getMapEmbedUrl()}
          className={`${heightClass} w-full border-0`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={getDirectionsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bolihon-green px-6 py-3 text-center text-base font-bold text-white shadow-md transition hover:bg-bolihon-green-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bolihon-green"
        >
          <Navigation aria-hidden="true" className="h-5 w-5 shrink-0" />
          Get directions
        </a>
        <a
          href={getAppleMapsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <MapIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          Open in Apple Maps
        </a>
      </div>
    </div>
  );
}

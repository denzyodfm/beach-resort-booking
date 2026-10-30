import { ResortMap } from "@/components/resort-map";

export function LocationMap() {
  return <div className="grid gap-6"><header><p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Staff and admin only</p><h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Interactive Resort Location Map</h1><p className="mt-3 text-slate-600">Use this map to help guests locate Bolihon Beach Resort in Carmen, Agusan del Norte. Guests can see the same map at <a href="/location" className="font-semibold text-cyan-700 underline">/location</a>.</p></header><ResortMap heightClass="h-[520px]" /></div>;
}

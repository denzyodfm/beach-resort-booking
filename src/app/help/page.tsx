import { Download } from "lucide-react";
import { ManualView } from "@/components/manual/manual-view";
import { manuals } from "@/lib/manuals";

export const metadata = {
  title: "Guest help | BOLIHON",
};

export default function HelpPage() {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Help</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">How to book at BOLIHON</h1>
        </div>
        <a
          href="/api/manuals/guest/pdf"
          download
          className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
        >
          <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
          Download guide (PDF)
        </a>
      </div>
      <ManualView manual={manuals.guest} />
    </section>
  );
}

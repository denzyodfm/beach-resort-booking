import { notFound } from "next/navigation";

import { ManualView } from "@/components/manual/manual-view";
import { canOpenManual } from "@/lib/manual-access";
import { manuals, type ManualRole } from "@/lib/manuals";

export const dynamic = "force-dynamic";

/**
 * Print layout for one manual. scripts/build-manual-pdfs.mjs turns this page
 * into the downloadable PDFs; it is not linked from the site.
 */
export default async function ManualPrintPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!(role in manuals)) notFound();

  const manual = manuals[role as ManualRole];
  if (!(await canOpenManual(manual.role))) notFound();

  return (
    <div data-manual-print className="mx-auto grid max-w-4xl gap-6 bg-white px-6 py-8">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">BOLIHON Beach Resort</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{manual.title}</h1>
        <p className="mt-2 leading-7 text-slate-600">{manual.summary}</p>
      </div>
      <ManualView manual={manual} showHeader={false} />
    </div>
  );
}

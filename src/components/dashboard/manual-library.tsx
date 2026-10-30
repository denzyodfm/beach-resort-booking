"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ManualView } from "@/components/manual/manual-view";
import { useDemoAuth } from "@/lib/demo-auth";
import { getManualsForRole, type ManualRole } from "@/lib/manuals";

/** Manual tab of the admin dashboard: the signed-in role's own manual first, plus the ones below it. */
export function ManualLibrary() {
  const { user } = useDemoAuth();
  const available = getManualsForRole(user?.role);
  const [selected, setSelected] = useState<ManualRole | null>(null);
  const manual = available.find((item) => item.role === selected) ?? available[0];

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Help</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">User manuals</h2>
        <p className="mt-1 text-sm text-slate-500">
          Step-by-step guides for each type of user. The guest manual is also public at{" "}
          <a href="/help" className="font-semibold text-bolihon-green underline">
            /help
          </a>{" "}
          so you can share it with guests. Front desk staff: see{" "}
          <a href="/manual/bolihon-front-desk-procedures.pdf" target="_blank" rel="noreferrer" className="font-semibold text-bolihon-green underline">
            the guest entrance &amp; accommodation procedures (PDF)
          </a>
          , also in the Staff manual.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Manuals" className="flex flex-wrap gap-2">
            {available.map((item) => (
              <button
                key={item.role}
                type="button"
                role="tab"
                aria-selected={item.role === manual.role}
                onClick={() => setSelected(item.role)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  item.role === manual.role ? "bg-bolihon-green text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <a
            href={`/api/manuals/${manual.role}/pdf`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
            Download {manual.label} (PDF)
          </a>
        </div>
      </section>

      <ManualView manual={manual} />
    </div>
  );
}

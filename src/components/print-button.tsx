"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print invoice" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-bolihon-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
    >
      <Printer aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

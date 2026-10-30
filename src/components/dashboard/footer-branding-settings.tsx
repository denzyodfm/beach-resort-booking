"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { defaultFooterSettings, normalizeFooterSettings, type FooterSettings } from "@/lib/footer-settings";

export function FooterBrandingSettings() {
  const [draft, setDraft] = useState<FooterSettings>(defaultFooterSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);

      try {
        const response = await fetch("/api/admin/footer-settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load footer settings.");
        if (!cancelled) setDraft(normalizeFooterSettings(data));
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load footer settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/footer-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save footer settings.");
      setDraft(normalizeFooterSettings(data));
      setMessage("Footer branding saved. Refresh the page to see it in the footer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save footer settings.");
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof FooterSettings, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Site branding</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">Footer credit</h2>
        <p className="mt-1 text-sm text-slate-500">
          Controls the &quot;Powered by&quot; strip at the bottom of every page. Bolihon Cove branding above it is
          not affected.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading footer settings...</p>
      ) : (
        <form onSubmit={saveSettings} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-4">
            <Field
              label="Badge text"
              value={draft.poweredByLabel}
              onChange={(value) => update("poweredByLabel", value)}
            />
            <Field
              label="Logo letter"
              value={draft.companyInitial}
              maxLength={2}
              onChange={(value) => update("companyInitial", value)}
            />
            <Field label="Company name" value={draft.companyName} onChange={(value) => update("companyName", value)} />
            <Field label="Team credit" value={draft.teamLabel} onChange={(value) => update("teamLabel", value)} />
            <button
              disabled={saving || !draft.companyName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4 shrink-0" />}
              {saving ? "Saving..." : "Save footer credit"}
            </button>
            {message ? <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{message}</p> : null}
          </div>

          <div className="grid gap-2 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Preview</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md bg-white px-4 py-4">
              <span className="rounded-full border-2 border-blue-900 bg-blue-700 px-4 py-1 text-sm font-bold italic text-white">
                {draft.poweredByLabel}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-serif text-4xl font-bold leading-none text-red-700">{draft.companyInitial}</span>
                <span className="font-serif text-sm tracking-wide text-red-700">{draft.companyName}</span>
              </span>
              <span className="text-sm font-semibold text-blue-700">{draft.teamLabel}</span>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const id = `footer-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

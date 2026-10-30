"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  defaultBookingSettings,
  formatPeso,
  getEntranceRates,
  normalizeBookingSettings,
  type BookingSettings,
} from "@/lib/booking-settings";

/** Admin → Users & settings: resort-wide online booking fees and payment instructions. */
export function OnlineBookingSettings() {
  const [draft, setDraft] = useState<BookingSettings>(defaultBookingSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/booking-settings")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: BookingSettings) => {
        if (active) setDraft(normalizeBookingSettings(data));
      })
      .catch(() => {
        if (active) setMessage("Unable to load the online booking settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/booking-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save the online booking settings.");
      setDraft(normalizeBookingSettings(data));
      setMessage("Saved. New bookings use these amounts right away; existing bookings keep the price they were booked at.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the online booking settings.");
    } finally {
      setSaving(false);
    }
  }

  function setAmount(field: "reservationFeeAmount" | "premiumFeeAmount" | "internetFeeAmount" | "entranceFeeAmount", value: string) {
    setDraft((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }));
  }

  const exampleRates = getEntranceRates(draft);
  const exampleEntrance = draft.entranceFeeAmount > 0 ? 2 * exampleRates.regular + exampleRates.child + exampleRates.senior : 0;

  return (
    <section className="rounded-lg border-2 border-bolihon-green bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Online booking</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">Fees and online payment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Charged once per online booking. Set an amount to 0 to turn that charge off. A cottage&apos;s own premium or
          reservation fee (Cottages tab) overrides these amounts. Walk-in bookings never pay the reservation or premium fee.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading online booking settings...</p>
      ) : (
        <form onSubmit={save} className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-4">
            <AmountField
              id="setting-reservation-fee"
              label="Reservation fee (every online booking)"
              value={draft.reservationFeeAmount}
              onChange={(value) => setAmount("reservationFeeAmount", value)}
            />
            <AmountField
              id="setting-premium-fee"
              label="Premium booking fee (guest picks the cottage)"
              value={draft.premiumFeeAmount}
              onChange={(value) => setAmount("premiumFeeAmount", value)}
            />
            <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-bold text-slate-950">Entrance fees (per guest, walk-in and online)</legend>
              <AmountField
                id="setting-entrance-fee"
                label="Regular rate (0 = no entrance fee)"
                value={draft.entranceFeeAmount}
                onChange={(value) => setAmount("entranceFeeAmount", value)}
              />
              <OptionalAmountField
                id="setting-entrance-child"
                label="Children rate"
                value={draft.entranceFeeChildAmount}
                regular={draft.entranceFeeAmount}
                onChange={(value) => setDraft((current) => ({ ...current, entranceFeeChildAmount: value }))}
              />
              <OptionalAmountField
                id="setting-entrance-senior"
                label="Senior citizen / PWD rate"
                value={draft.entranceFeeSeniorAmount}
                regular={draft.entranceFeeAmount}
                onChange={(value) => setDraft((current) => ({ ...current, entranceFeeSeniorAmount: value }))}
              />
              <div>
                <label htmlFor="setting-entrance-note" className="text-sm font-semibold text-slate-700">
                  Entrance fee rules shown to guests
                </label>
                <input
                  id="setting-entrance-note"
                  value={draft.entranceFeeNote}
                  maxLength={300}
                  onChange={(event) => setDraft((current) => ({ ...current, entranceFeeNote: event.target.value }))}
                  placeholder="Children: 3 to 12 years old. Seniors and PWD: show a valid ID at the gate."
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
                />
              </div>
              <p className="text-xs text-slate-500">Leave a discounted rate blank to charge the regular rate; enter 0 to make it free.</p>
            </fieldset>
            <AmountField
              id="setting-internet-fee"
              label="Internet access add-on (0 = not offered)"
              value={draft.internetFeeAmount}
              onChange={(value) => setAmount("internetFeeAmount", value)}
            />
          </div>
          <div className="grid content-start gap-4">
            <div>
              <label htmlFor="setting-payment-instructions" className="text-sm font-semibold text-slate-700">
                Payment instructions shown to guests
              </label>
              <textarea
                id="setting-payment-instructions"
                value={draft.paymentInstructions}
                maxLength={1000}
                onChange={(event) => setDraft((current) => ({ ...current, paymentInstructions: event.target.value }))}
                placeholder={"GCash: 0917 123 4567 (Juan Dela Cruz)\nBDO savings: 0012 3456 7890 (BOLIHON Beach Resort)"}
                className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                Shown on the payment step after booking and on Pay / Track Booking. Include the account number and name.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Example: Php700 cottage, one day, 2 adults + 1 child + 1 senior</p>
              <p className="mt-1">
                Standard: {formatPeso(700 + draft.reservationFeeAmount + exampleEntrance)} · Premium:{" "}
                {formatPeso(700 + draft.reservationFeeAmount + draft.premiumFeeAmount + exampleEntrance)}
                {draft.internetFeeAmount > 0 ? ` · + internet ${formatPeso(draft.internetFeeAmount)}` : ""}
              </p>
            </div>
            <button
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4 shrink-0" />}
              {saving ? "Saving..." : "Save online booking settings"}
            </button>
            {message ? <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{message}</p> : null}
          </div>
        </form>
      )}
    </section>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-cyan-600">
        <span className="px-3 text-sm font-semibold text-slate-500">Php</span>
        <input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-r-md px-3 py-3 text-sm outline-none"
        />
      </div>
    </div>
  );
}

/** Amount that may be left blank, meaning "same as the regular rate". */
function OptionalAmountField({
  id,
  label,
  value,
  regular,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  regular: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-cyan-600">
        <span className="px-3 text-sm font-semibold text-slate-500">Php</span>
        <input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={value === null ? "" : String(value)}
          placeholder={`Same as regular (${formatPeso(regular)})`}
          onChange={(event) => onChange(event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0))}
          className="w-full rounded-r-md px-3 py-3 text-sm outline-none"
        />
      </div>
    </div>
  );
}

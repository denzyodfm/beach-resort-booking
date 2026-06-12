"use client";

import { useState } from "react";
import type { Room } from "@/lib/types";

export function ReviewForm({ rooms }: { rooms: Room[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, guestName, guestEmail, rating, title, body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to submit review.");

      setTitle("");
      setBody("");
      setMessage(result.message || "Thanks. Your review is waiting for admin approval.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitReview} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/10">
      <div>
        <label htmlFor="reviewRoom" className="text-sm font-semibold text-slate-700">
          Cottage
        </label>
        <select
          id="reviewRoom"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" id="reviewName" value={guestName} onChange={setGuestName} />
        <Field label="Email (optional)" id="reviewEmail" type="email" value={guestEmail} onChange={setGuestEmail} required={false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor="reviewRating" className="text-sm font-semibold text-slate-700">
            Rating
          </label>
          <select
            id="reviewRating"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        <Field label="Review title" id="reviewTitle" value={title} onChange={setTitle} required={false} />
      </div>

      <div>
        <label htmlFor="reviewBody" className="text-sm font-semibold text-slate-700">
          Your experience
        </label>
        <textarea
          id="reviewBody"
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-2 min-h-36 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
        />
      </div>

      <button
        disabled={saving}
        className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {saving ? "Submitting..." : "Submit review"}
      </button>

      {message ? <p className="rounded-md bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">{message}</p> : null}
    </form>
  );
}

function Field({
  label,
  id,
  value,
  type = "text",
  required = true,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

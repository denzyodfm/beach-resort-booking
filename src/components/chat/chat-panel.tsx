"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMessage,
  getConversations,
  getOrCreateConversation,
  type ChatConversation,
} from "@/lib/demo-chat";
import { canManageResort, useDemoAuth } from "@/lib/demo-auth";

type GuestContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

const guestKey = "bolihon-chat-guest";

function readStoredGuest() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(guestKey);
    return stored ? (JSON.parse(stored) as GuestContact) : null;
  } catch {
    return null;
  }
}

export function ChatPanel() {
  const { user } = useDemoAuth();
  const [guest, setGuest] = useState<GuestContact | null>(() => readStoredGuest());
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [draft, setDraft] = useState("");

  const activeGuest = useMemo(() => {
    if (user?.role === "guest") {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      };
    }

    return guest;
  }, [guest, user]);

  useEffect(() => {
    function sync() {
      if (canManageResort(user?.role)) {
        const all = getConversations().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setConversations(all);
        setSelectedId((current) => current || all[0]?.id || "");
      } else if (activeGuest) {
        const conversation = getOrCreateConversation(activeGuest);
        setConversations([conversation]);
        setSelectedId(conversation.id);
      } else {
        setConversations([]);
        setSelectedId("");
      }
    }

    sync();
    window.addEventListener("bolihon-chat-updated", sync);
    window.addEventListener("bolihon-auth-updated", sync);

    return () => {
      window.removeEventListener("bolihon-chat-updated", sync);
      window.removeEventListener("bolihon-auth-updated", sync);
    };
  }, [activeGuest, user]);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );

  function startGuestChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) return;

    const nextGuest = {
      id: `guest-${trimmedPhone.replace(/\D/g, "") || Date.now()}`,
      name: trimmedName,
      email: "",
      phone: trimmedPhone,
    };
    try {
      window.localStorage.setItem(guestKey, JSON.stringify(nextGuest));
    } catch {
      // Chat still works for this page session if mobile storage is blocked.
    }
    setGuest(nextGuest);
    const conversation = getOrCreateConversation(nextGuest);
    setConversations([conversation]);
    setSelectedId(conversation.id);
    setDraft("");
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;

    const sender =
      canManageResort(user?.role)
        ? { role: user.role, name: user.name }
        : { role: "guest" as const, name: activeGuest?.name || "Guest" };

    addMessage(selected.id, sender, draft);
    setDraft("");
  }

  if (!user && !activeGuest) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">BOLIHON support</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Chat with admin</h1>
        <p className="mt-3 text-slate-600">
          Guests can message BOLIHON without logging in. Please provide your name and cellphone number so admin can identify your booking.
        </p>
        <form onSubmit={startGuestChat} className="mt-6 grid gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Guest name"
            required
            className="min-h-12 rounded-md border border-slate-300 px-4 outline-none ring-bolihon-green focus:ring-2"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Cellphone no."
            required
            className="min-h-12 rounded-md border border-slate-300 px-4 outline-none ring-bolihon-green focus:ring-2"
          />
          <button className="rounded-full bg-bolihon-green px-6 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark">
            Start chat
          </button>
        </form>
      </div>
    );
  }

  if (!canManageResort(user?.role)) {
    return (
      <section className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">BOLIHON support</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Message admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            {selected ? `${selected.guestName} - ${selected.guestPhone || "No cellphone"}` : "Chat started"}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {selected?.messages.map((message) => {
            const own = message.senderRole === "guest";
            return (
              <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-lg px-4 py-3 text-sm shadow-sm ${own ? "bg-bolihon-green text-white" : "bg-white text-slate-700"}`}>
                  <p className="text-xs font-semibold opacity-80">{message.senderName}</p>
                  <p className="mt-1 leading-6">{message.body}</p>
                  <p className="mt-2 text-[11px] opacity-70">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
          {!selected?.messages.length ? (
            <p className="rounded-md bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
              Chat is ready. Type your message below and admin can reply here.
            </p>
          ) : null}
        </div>

        <form onSubmit={sendMessage} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-[1fr_auto]">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            disabled={!selected}
            className="min-h-12 rounded-md border border-slate-300 px-4 outline-none ring-bolihon-green focus:ring-2 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!selected || !draft.trim()}
            className="rounded-full bg-bolihon-green px-6 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
          {canManageResort(user?.role) ? "Guest inbox" : "BOLIHON support"}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Messages</h1>
        <div className="mt-5 grid gap-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
              className={`rounded-md border p-3 text-left transition ${
                selectedId === conversation.id
                  ? "border-bolihon-green bg-lime-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block font-semibold text-slate-950">{conversation.guestName}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {conversation.guestPhone || conversation.guestEmail || "No contact"}
              </span>
              <span className="mt-2 block truncate text-sm text-slate-600">
                {conversation.messages.at(-1)?.body || "No messages yet"}
              </span>
            </button>
          ))}
          {conversations.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No guest messages yet.</p>
          ) : null}
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-500">
            {selected ? `${selected.guestName} - ${selected.guestPhone || selected.guestEmail}` : "Select a conversation"}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            {canManageResort(user?.role) ? "Reply to guest" : "Message admin"}
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
          {selected?.messages.map((message) => {
            const own = canManageResort(user?.role) ? canManageResort(message.senderRole) : message.senderRole === "guest";
            return (
              <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-lg px-4 py-3 text-sm shadow-sm ${own ? "bg-bolihon-green text-white" : "bg-white text-slate-700"}`}>
                  <p className="text-xs font-semibold opacity-80">{message.senderName}</p>
                  <p className="mt-1 leading-6">{message.body}</p>
                  <p className="mt-2 text-[11px] opacity-70">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
          {selected && selected.messages.length === 0 ? (
            <p className="rounded-md bg-white p-5 text-center text-sm text-slate-500">
              Start the conversation. Ask about availability, booking confirmation, payment, or cottage details.
            </p>
          ) : null}
        </div>

        <form onSubmit={sendMessage} className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={canManageResort(user?.role) ? "Type reply..." : "Type your message..."}
            disabled={!selected}
            className="min-h-12 flex-1 rounded-md border border-slate-300 px-4 outline-none ring-bolihon-green focus:ring-2 disabled:bg-slate-100"
          />
          <button
            disabled={!selected || !draft.trim()}
            className="rounded-full bg-bolihon-green px-6 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}

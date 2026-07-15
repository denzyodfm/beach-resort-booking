"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  addMessage,
  getChatStats,
  getConversations,
  getOrCreateConversation,
  refreshAutoReplyKnowledge,
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

export function FloatingChat() {
  const { user } = useDemoAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<GuestContact | null>(() => readStoredGuest());
  const [, setChatVersion] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [draft, setDraft] = useState("");
  const [adminDraft, setAdminDraft] = useState("");
  const [selectedAdminConversationId, setSelectedAdminConversationId] = useState("");

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

  const stats = getChatStats();
  const adminConversations =
    canManageResort(user?.role)
      ? getConversations().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  const selectedAdminConversation =
    adminConversations.find((item) => item.id === selectedAdminConversationId) || adminConversations[0] || null;
  const conversation = activeGuest
    ? getConversations().find((item) => item.id === activeGuest.id) || null
    : null;

  useEffect(() => {
    void refreshAutoReplyKnowledge();

    function sync() {
      setChatVersion((current) => current + 1);
    }

    window.addEventListener("bolihon-chat-updated", sync);

    return () => window.removeEventListener("bolihon-chat-updated", sync);
  }, []);

  function startChat(event: React.FormEvent<HTMLFormElement>) {
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
    getOrCreateConversation(nextGuest);
    setChatVersion((current) => current + 1);
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeGuest || !draft.trim()) return;
    const nextConversation = conversation || getOrCreateConversation(activeGuest);
    addMessage(nextConversation.id, { role: "guest", name: activeGuest.name }, draft);
    setDraft("");
  }

  function sendAdminReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAdminConversation || !adminDraft.trim() || !user) return;

    addMessage(selectedAdminConversation.id, { role: canManageResort(user.role) ? user.role : "admin", name: user.name }, adminDraft);
    setAdminDraft("");
  }

  if (pathname === "/chat") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] flex justify-end sm:inset-x-auto sm:bottom-5 sm:right-5">
      {open ? (
        <div className="absolute bottom-20 right-0 hidden max-h-[calc(100dvh-7rem)] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:block sm:w-[380px]">
          <div className="flex items-start justify-between gap-4 bg-bolihon-green p-4 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-100">BOLIHON chat</p>
              <h2 className="mt-1 text-lg font-bold">Message admin</h2>
              <p className="mt-1 text-xs text-lime-50">Today: {stats.today} chat{stats.today === 1 ? "" : "s"} · Total: {stats.total}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20"
              aria-label="Close chat"
            >
              x
            </button>
          </div>

          {canManageResort(user?.role) ? (
            <>
              <div className="border-b border-slate-200 bg-slate-50 p-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {adminConversations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedAdminConversationId(item.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        selectedAdminConversation?.id === item.id
                          ? "border-bolihon-green bg-bolihon-green text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {item.guestName}
                    </button>
                  ))}
                  {adminConversations.length === 0 ? (
                    <p className="text-sm text-slate-500">No guest messages yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="max-h-[42dvh] space-y-3 overflow-y-auto bg-slate-50 p-4 sm:max-h-80">
                {selectedAdminConversation?.messages.map((message) => {
                  const own = canManageResort(message.senderRole);
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${own ? "bg-bolihon-green text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                        <p className="text-xs font-semibold opacity-75">{message.senderName}</p>
                        <p className="mt-1 leading-5">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendAdminReply} className="flex gap-2 border-t border-slate-200 p-3">
                <input
                  value={adminDraft}
                  onChange={(event) => setAdminDraft(event.target.value)}
                  placeholder={selectedAdminConversation ? "Type reply..." : "No guest selected"}
                  disabled={!selectedAdminConversation}
                  className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none ring-bolihon-green focus:ring-2 disabled:bg-slate-100"
                />
                <button
                  disabled={!selectedAdminConversation || !adminDraft.trim()}
                  className="rounded-full bg-bolihon-green px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Reply
                </button>
              </form>

              <div className="border-t border-slate-100 px-4 py-3">
                <Link href="/chat" className="text-sm font-semibold text-bolihon-green">
                  Open full inbox
                </Link>
              </div>
            </>
          ) : activeGuest ? (
            <>
              <div className="max-h-[42dvh] space-y-3 overflow-y-auto bg-slate-50 p-4 sm:max-h-80">
                {(conversation?.messages || []).map((message) => {
                  const own = message.senderRole === "guest";
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${own ? "bg-bolihon-green text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                        <p className="text-xs font-semibold opacity-75">{message.senderName}</p>
                        <p className="mt-1 leading-5">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
                {!conversation?.messages.length ? (
                  <p className="rounded-md bg-white p-4 text-sm text-slate-500 shadow-sm">
                    Hi {activeGuest.name}. Send your question about cottages, rates, availability, or pending booking confirmation.
                  </p>
                ) : null}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 p-3">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type your message..."
                  className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none ring-bolihon-green focus:ring-2"
                />
                <button
                  disabled={!draft.trim()}
                  className="rounded-full bg-bolihon-green px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={startChat} className="grid gap-3 p-4">
              <p className="text-sm leading-6 text-slate-600">
                Enter your name and cellphone number so admin can identify and confirm your booking.
              </p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Guest name"
                required
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none ring-bolihon-green focus:ring-2"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Cellphone no."
                required
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none ring-bolihon-green focus:ring-2"
              />
              <button className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white">
                Start chat
              </button>
            </form>
          )}
        </div>
      ) : null}

      <button
        onClick={() => setOpen((current) => !current)}
        className="relative hidden min-h-16 items-center gap-3 rounded-full bg-bolihon-green px-5 py-3 text-left text-white shadow-2xl shadow-slate-950/25 transition hover:bg-bolihon-green-dark sm:flex"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg font-bold">?</span>
        <span>
          <span className="block text-sm font-bold">Chat with us</span>
          <span className="block text-xs text-lime-50">Today {stats.today} · Total {stats.total}</span>
        </span>
        {stats.today > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-7 min-w-7 place-items-center rounded-full bg-coral px-2 text-xs font-bold text-white">
            {stats.today}
          </span>
        ) : null}
      </button>
      <Link
        href="/chat"
        className="relative flex min-h-16 items-center gap-3 rounded-full bg-bolihon-green px-5 py-3 text-left text-white shadow-2xl shadow-slate-950/25 transition hover:bg-bolihon-green-dark sm:hidden"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg font-bold">?</span>
        <span>
          <span className="block text-sm font-bold">Chat with us</span>
          <span className="block text-xs text-lime-50">Open messages</span>
        </span>
        {stats.today > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-7 min-w-7 place-items-center rounded-full bg-coral px-2 text-xs font-bold text-white">
            {stats.today}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

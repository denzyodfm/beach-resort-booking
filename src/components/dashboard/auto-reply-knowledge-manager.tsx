"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeKnowledgeItem, type AutoReplyKnowledgeItem } from "@/lib/auto-reply-knowledge";
import { refreshAutoReplyKnowledge } from "@/lib/demo-chat";
import { useDemoAuth } from "@/lib/demo-auth";

type KnowledgeResponse = {
  items: AutoReplyKnowledgeItem[];
  mode?: "demo" | "supabase" | "setup_required";
  message?: string;
};

type KnowledgeDraft = {
  id: string;
  title: string;
  keywords: string;
  response: string;
  sortOrder: string;
};

const emptyDraft: KnowledgeDraft = {
  id: "",
  title: "",
  keywords: "",
  response: "",
  sortOrder: "100",
};

export function AutoReplyKnowledgeManager() {
  const { user } = useDemoAuth();
  const [items, setItems] = useState<AutoReplyKnowledgeItem[]>([]);
  const [draft, setDraft] = useState<KnowledgeDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedExists = useMemo(
    () => Boolean(draft.id && items.some((item) => item.id === draft.id)),
    [draft.id, items],
  );

  function selectItem(item: AutoReplyKnowledgeItem) {
    setDraft({
      id: item.id,
      title: item.title,
      keywords: item.keywords.join(", "),
      response: item.response,
      sortOrder: String(item.sortOrder),
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialKnowledge() {
      setLoading(true);
      try {
        const response = await fetch("/api/auto-reply-knowledge", { cache: "no-store" });
        const data = (await response.json()) as KnowledgeResponse;
        if (!response.ok) throw new Error(data.message || "Unable to load auto-reply knowledge.");

        const nextItems = (data.items || []).map(normalizeKnowledgeItem);
        if (cancelled) return;

        setItems(nextItems);
        setMessage(data.message || "");
        if (nextItems[0]) {
          setDraft({
            id: nextItems[0].id,
            title: nextItems[0].title,
            keywords: nextItems[0].keywords.join(", "),
            response: nextItems[0].response,
            sortOrder: String(nextItems[0].sortOrder),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load auto-reply knowledge.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialKnowledge();

    return () => {
      cancelled = true;
    };
  }, []);

  function startNewItem() {
    setDraft({
      ...emptyDraft,
      id: `draft-${Date.now()}`,
      sortOrder: String((items.at(-1)?.sortOrder || 90) + 10),
    });
    setMessage("");
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const responseText = draft.response.trim();
    const keywords = draft.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!title || !responseText || keywords.length === 0) {
      setMessage("Add a title, at least one keyword, and the reply text.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        id: selectedExists ? draft.id : "",
        title,
        keywords,
        response: responseText,
        sortOrder: Number(draft.sortOrder || 100),
      };
      const response = await fetch("/api/auto-reply-knowledge", {
        method: selectedExists ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-demo-role": user?.role || "" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save auto-reply knowledge.");

      const saved = normalizeKnowledgeItem(data);
      setItems((current) => {
        const exists = current.some((item) => item.id === saved.id);
        const next = exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });
      selectItem(saved);
      await refreshAutoReplyKnowledge();
      setMessage("Auto-reply knowledge saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save auto-reply knowledge.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!selectedExists) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/auto-reply-knowledge?id=${encodeURIComponent(draft.id)}`, {
        method: "DELETE",
        headers: { "x-demo-role": user?.role || "" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete auto-reply knowledge.");

      const nextItems = items.filter((item) => item.id !== draft.id);
      setItems(nextItems);
      setDraft(emptyDraft);
      if (nextItems[0]) selectItem(nextItems[0]);
      await refreshAutoReplyKnowledge();
      setMessage("Auto-reply knowledge deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete auto-reply knowledge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Guest messaging</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Auto-reply knowledge</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Add resort facts and trigger keywords. Guest inquiries will use the best matching response before admin follows up.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewItem}
          className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
        >
          Add information
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-3">
          {loading ? <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">Loading auto-reply knowledge...</p> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item)}
              className={`rounded-md border p-4 text-left transition ${
                draft.id === item.id ? "border-bolihon-green bg-lime-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block font-bold text-slate-950">{item.title}</span>
              <span className="mt-2 block text-xs text-slate-500">{item.keywords.join(", ")}</span>
              <span className="mt-2 block line-clamp-2 text-sm leading-6 text-slate-600">{item.response}</span>
            </button>
          ))}
          {!loading && items.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No auto-reply information yet.</p>
          ) : null}
        </div>

        <form onSubmit={saveItem} className="grid gap-4 rounded-lg bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <KnowledgeField
              label="Information title"
              value={draft.title}
              onChange={(title) => setDraft((current) => ({ ...current, title }))}
            />
            <KnowledgeField
              label="Sort order"
              type="number"
              value={draft.sortOrder}
              onChange={(sortOrder) => setDraft((current) => ({ ...current, sortOrder }))}
            />
          </div>
          <KnowledgeField
            label="Trigger keywords"
            value={draft.keywords}
            onChange={(keywords) => setDraft((current) => ({ ...current, keywords }))}
            placeholder="rates, price, cost"
          />
          <div>
            <label htmlFor="auto-reply-response" className="text-sm font-semibold text-slate-700">
              Auto-reply response
            </label>
            <textarea
              id="auto-reply-response"
              value={draft.response}
              onChange={(event) => setDraft((current) => ({ ...current, response: event.target.value }))}
              rows={6}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 outline-none ring-cyan-600 focus:ring-2"
            />
          </div>
          {message ? <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              disabled={saving}
              className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:bg-slate-300"
            >
              {selectedExists ? "Save information" : "Create information"}
            </button>
            <button
              type="button"
              onClick={deleteItem}
              disabled={!selectedExists || saving}
              className="rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function KnowledgeField({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none ring-cyan-600 focus:ring-2"
      />
    </div>
  );
}

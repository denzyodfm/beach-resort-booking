"use client";

import { useState } from "react";
import { GripVertical, RotateCcw, type LucideIcon } from "lucide-react";

export type DraggableTab<Id extends string> = {
  id: Id;
  label: string;
  icon: LucideIcon;
  /** Small count shown after the label, hidden when 0 or undefined. */
  badge?: number;
};

/**
 * Reads a saved tab order from this browser. Tabs added since it was saved go
 * at the end; tabs that no longer exist (or this role cannot see) are dropped.
 */
export function readTabOrder<Id extends string>(storageKey: string, ids: Id[]): Id[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[];
    const known = saved.filter((id): id is Id => ids.includes(id as Id));
    return [...known, ...ids.filter((id) => !known.includes(id))];
  } catch {
    return ids;
  }
}

/**
 * Tab bar whose tabs can be dragged into the order a staff member prefers.
 * Keyboard: focus a tab and press Alt+← / Alt+→ to move it. The order is kept
 * per browser in localStorage; "Reset order" restores the default.
 */
export function DraggableTabs<Id extends string>({
  tabs,
  order,
  onOrderChange,
  active,
  onSelect,
  storageKey,
  ariaLabel,
  className = "",
}: {
  tabs: DraggableTab<Id>[];
  order: Id[];
  onOrderChange: (order: Id[]) => void;
  active: Id;
  onSelect: (id: Id) => void;
  storageKey: string;
  ariaLabel: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState<Id | null>(null);
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  const ordered = [
    ...order.map((id) => byId.get(id)).filter((tab): tab is DraggableTab<Id> => Boolean(tab)),
    ...tabs.filter((tab) => !order.includes(tab.id)),
  ];
  const defaultOrder = tabs.map((tab) => tab.id);
  const customised = ordered.some((tab, index) => tab.id !== defaultOrder[index]);

  function save(next: Id[]) {
    onOrderChange(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private windows may block storage; the order still applies until reload.
    }
  }

  function move(id: Id, toIndex: number) {
    const current = ordered.map((tab) => tab.id);
    const from = current.indexOf(id);
    if (from < 0 || toIndex < 0 || toIndex >= current.length || from === toIndex) return current;
    const next = current.slice();
    next.splice(from, 1);
    next.splice(toIndex, 0, id);
    return next;
  }

  function reset() {
    onOrderChange(defaultOrder);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore blocked storage.
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {ordered.map((tab, index) => {
          const Icon = tab.icon;
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              draggable
              title="Drag to reorder (or Alt + arrow keys)"
              onClick={() => onSelect(tab.id)}
              onDragStart={(event) => {
                setDragging(tab.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragOver={(event) => {
                if (!dragging || dragging === tab.id) return;
                event.preventDefault();
                onOrderChange(move(dragging, index));
              }}
              onDrop={(event) => {
                event.preventDefault();
                save(ordered.map((item) => item.id));
              }}
              onDragEnd={() => {
                if (dragging) save(ordered.map((item) => item.id));
                setDragging(null);
              }}
              onKeyDown={(event) => {
                if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
                event.preventDefault();
                save(move(tab.id, index + (event.key === "ArrowLeft" ? -1 : 1)));
                window.requestAnimationFrame(() => event.currentTarget?.focus());
              }}
              className={`group inline-flex cursor-grab items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition active:cursor-grabbing ${
                selected ? "bg-bolihon-green text-white" : "text-slate-600 hover:bg-slate-100"
              } ${dragging === tab.id ? "opacity-50 ring-2 ring-bolihon-green ring-offset-1" : ""}`}
            >
              <GripVertical aria-hidden="true" className={`-ml-2 h-3.5 w-3.5 shrink-0 ${selected ? "text-white/60" : "text-slate-300 group-hover:text-slate-400"}`} />
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              {tab.label}
              {tab.badge ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${selected ? "bg-white text-bolihon-green" : "bg-amber-400 text-amber-950"}`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {customised ? (
        <button
          type="button"
          onClick={reset}
          title="Put the tabs back in their default order"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Reset order
        </button>
      ) : null}
    </div>
  );
}

export type TabbedSection<Id extends string> = DraggableTab<Id> & { content: React.ReactNode };

/**
 * A row of draggable sub-tabs with the selected section below it. Opens on the
 * first tab in the saved order. Pass `active` and `onActiveChange` to control
 * the selected tab from outside (for example, a banner that jumps to a tab).
 */
export function TabbedSections<Id extends string>({
  sections,
  storageKey,
  ariaLabel,
  active,
  onActiveChange,
}: {
  sections: TabbedSection<Id>[];
  storageKey: string;
  ariaLabel: string;
  active?: Id;
  onActiveChange?: (id: Id) => void;
}) {
  const ids = sections.map((section) => section.id);
  const [order, setOrder] = useState<Id[]>(() => readTabOrder(storageKey, ids));
  const [ownActive, setOwnActive] = useState<Id>(() => order[0] ?? ids[0]);
  const selected = active ?? ownActive;
  const select = (id: Id) => (onActiveChange ? onActiveChange(id) : setOwnActive(id));
  const current = sections.find((section) => section.id === selected) ?? sections[0];

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <DraggableTabs
          ariaLabel={ariaLabel}
          storageKey={storageKey}
          tabs={sections}
          order={order}
          onOrderChange={setOrder}
          active={current?.id ?? selected}
          onSelect={select}
        />
      </div>
      {current?.content}
    </>
  );
}

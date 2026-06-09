"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RoomCard } from "@/components/room-card";
import type { Room } from "@/lib/types";

type CottageType = Room["type"];

const categoryCards: { type: CottageType; label: string; rate: string }[] = [
  { type: "cove", label: "Cove 1-45", rate: "Php700/day" },
  { type: "rock", label: "Rock 1-6", rate: "Php800/day" },
  { type: "rd", label: "RD 1-8", rate: "Php800/day" },
  { type: "hall", label: "VGP Hall", rate: "Php4,500/day" },
  { type: "pavillon", label: "Pavillon", rate: "Php3,500/day" },
];

const groupLabels = {
  cove: "Cove cottages",
  rock: "Rock cottages",
  rd: "RD cottages",
  hall: "VGP Hall",
  pavillon: "Pavillon",
};

const groupDescriptions = {
  cove: "Cove 1 to 45 - Php700/day",
  rock: "Rock 1 to 6 - Php800/day",
  rd: "RD 1 to 8 - Php800/day",
  hall: "Event cottage - Php4,500/day",
  pavillon: "Open-air cottage - Php3,500/day",
};

export function CottageSearchList({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const selectedCategory = categoryCards.some((category) => category.type === categoryParam)
    ? (categoryParam as CottageType)
    : null;
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const filteredRooms = useMemo(() => {
    const normalized = submittedQuery.trim().toLowerCase();
    const categoryRooms = selectedCategory
      ? rooms.filter((room) => room.type === selectedCategory)
      : rooms;

    if (!normalized) return categoryRooms;

    return categoryRooms.filter((room) =>
      [room.name, room.type, room.description, room.pricePerNight.toString()]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [rooms, selectedCategory, submittedQuery]);

  const groupedRooms = useMemo(
    () =>
      (["cove", "rock", "rd", "hall", "pavillon"] as const)
        .map((type) => ({
          type,
          rooms: filteredRooms.filter((room) => room.type === type),
        }))
        .filter((group) => group.rooms.length > 0),
    [filteredRooms],
  );

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query);
  }

  function selectCategory(type: CottageType) {
    const params = new URLSearchParams(searchParams.toString());

    if (selectedCategory === type) {
      params.delete("category");
    } else {
      params.set("category", type);
    }

    router.replace(params.toString() ? `/rooms?${params.toString()}` : "/rooms", { scroll: false });
  }

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {categoryCards.map((category) => {
          const selected = selectedCategory === category.type;
          return (
            <button
              key={category.type}
              type="button"
              onClick={() => selectCategory(category.type)}
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-bolihon-green bg-bolihon-green text-white shadow-lg shadow-lime-900/10"
                  : "border-lime-200 bg-lime-50 text-slate-950 hover:border-bolihon-green"
              }`}
            >
              <span className={`block text-xs font-bold uppercase tracking-[0.18em] ${selected ? "text-lime-100" : "text-bolihon-green"}`}>
                {category.label}
              </span>
              <span className="mt-2 block text-xl font-bold">{category.rate}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={search} className="mt-8 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <label htmlFor="cottageSearch" className="sr-only">
          Search cottages
        </label>
        <input
          id="cottageSearch"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Cove 12, Rock, RD, VGP Hall..."
          className="min-h-12 flex-1 rounded-md border border-slate-200 px-4 text-sm outline-none ring-bolihon-green focus:ring-2"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-12 rounded-full bg-bolihon-green px-6 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark"
          >
            Search
          </button>
          {submittedQuery ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSubmittedQuery("");
              }}
              className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <p>
          Showing {filteredRooms.length} of {rooms.length} cottages
          {selectedCategory ? ` in ${groupLabels[selectedCategory]}` : ""}
        </p>
        <div className="flex items-center gap-3">
          {submittedQuery ? <p>Search: &ldquo;{submittedQuery}&rdquo;</p> : null}
          {selectedCategory ? (
            <button
              type="button"
              onClick={() => router.replace("/rooms", { scroll: false })}
              className="font-semibold text-bolihon-green"
            >
              Show all
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-10">
        {groupedRooms.map((group) => (
          <section key={group.type}>
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">{groupLabels[group.type]}</h2>
                <p className="mt-1 text-sm font-semibold text-bolihon-green">
                  {groupDescriptions[group.type]}
                </p>
              </div>
              <p className="text-sm text-slate-500">{group.rooms.length} available listing{group.rooms.length === 1 ? "" : "s"}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {group.rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

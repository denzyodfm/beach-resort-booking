import { CottageSearchList } from "@/components/cottage-search-list";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const { rooms, categories } = await getRoomCatalog();

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-700">Cottages</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Choose your BOLIHON cottage</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Browse cottages by type, compare rates quickly, and book the right space for your stay.
        </p>
      </div>
      <CottageSearchList rooms={rooms} categories={categories} />
    </section>
  );
}

import { AdminGate } from "@/components/dashboard/admin-gate";
import { MonitoringStation } from "@/components/dashboard/monitoring-station";
import { getBookingSettings } from "@/lib/booking-settings-server";
import { getRoomCatalog } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const [{ rooms, categories }, settings] = await Promise.all([getRoomCatalog({ includeInactive: true }), getBookingSettings()]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminGate>
        <MonitoringStation rooms={rooms} categories={categories} resortToday={getResortToday()} settings={settings} />
      </AdminGate>
    </section>
  );
}

function getResortToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

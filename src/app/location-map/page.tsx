import { AdminGate } from "@/components/dashboard/admin-gate";
import { LocationMap } from "@/components/dashboard/location-map";

export default function LocationMapPage() {
  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><AdminGate><LocationMap /></AdminGate></section>;
}

import { AdminGate } from "@/components/dashboard/admin-gate";
import { MonitoringStation } from "@/components/dashboard/monitoring-station";

export default function MonitoringPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminGate>
        <MonitoringStation />
      </AdminGate>
    </section>
  );
}

import { AdminGate } from "@/components/dashboard/admin-gate";

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminGate />
    </section>
  );
}

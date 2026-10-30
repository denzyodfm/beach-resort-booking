import { getBookingChannel } from "@/lib/booking-settings";
import type { Room } from "@/lib/types";

/** "Online booking" or "Walk-in only" pill for a cottage. */
export function BookingChannelBadge({ room, className = "" }: { room: Room; className?: string }) {
  const walkIn = getBookingChannel(room) === "walk_in";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
        walkIn ? "bg-slate-800 text-white" : "bg-emerald-600 text-white"
      } ${className}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${walkIn ? "bg-amber-300" : "bg-white"}`} />
      {walkIn ? "Walk-in only" : "Online booking"}
    </span>
  );
}

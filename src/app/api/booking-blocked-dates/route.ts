import { getBookingBlockedDates } from "@/lib/booking-blocked-dates-server";

export async function GET() {
  return Response.json(await getBookingBlockedDates());
}

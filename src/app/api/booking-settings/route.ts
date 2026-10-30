import { requireAdminUser } from "@/lib/admin-auth";
import { normalizeBookingSettings } from "@/lib/booking-settings";
import { getBookingSettings } from "@/lib/booking-settings-server";
import { errorMessage, execute } from "@/lib/db";

/** Public: the booking screens need the fees and payment instructions. */
export async function GET() {
  return Response.json(await getBookingSettings());
}

export async function PUT(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as Record<string, unknown>;
  const settings = normalizeBookingSettings(body);

  if (settings.entranceFeeNote.length > 300) {
    return Response.json({ message: "Keep the entrance fee note under 300 characters." }, { status: 400 });
  }

  if (settings.paymentInstructions.length > 1000) {
    return Response.json({ message: "Keep the payment instructions under 1,000 characters." }, { status: 400 });
  }

  try {
    await execute(
      `update resort_settings
          set reservation_fee_amount = ?, premium_fee_amount = ?, internet_fee_amount = ?, entrance_fee_amount = ?,
              entrance_fee_child_amount = ?, entrance_fee_senior_amount = ?, entrance_fee_note = ?, payment_instructions = ?
        where id = 1`,
      [
        settings.reservationFeeAmount,
        settings.premiumFeeAmount,
        settings.internetFeeAmount,
        settings.entranceFeeAmount,
        settings.entranceFeeChildAmount,
        settings.entranceFeeSeniorAmount,
        settings.entranceFeeNote || null,
        settings.paymentInstructions || null,
      ],
    );
    return Response.json(await getBookingSettings());
  } catch (error) {
    const message = errorMessage(error);
    return Response.json(
      {
        message: message.includes("Unknown column")
          ? "Run node --env-file=.env.local scripts/migrate-online-booking.mjs to add the booking settings columns."
          : message,
      },
      { status: 500 },
    );
  }
}

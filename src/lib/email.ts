type BookingEmailPayload = {
  to?: string;
  guestName: string;
  bookingId: string;
  cottageName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
};

export async function sendBookingConfirmationEmail(payload: BookingEmailPayload) {
  if (!payload.to) {
    return {
      sent: false,
      reason: "No email was provided. Use the guest cellphone number to confirm this pending booking.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOOKING_FROM_EMAIL;

  if (!hasRealEmailConfig(apiKey, from)) {
    return {
      sent: false,
      reason: "No real email was sent because email is not configured. Add RESEND_API_KEY and BOOKING_FROM_EMAIL to enable confirmation emails.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: `BOLIHON pending booking ${payload.bookingId}`,
      text: [
        `Hi ${payload.guestName},`,
        "",
        `Your pending booking ${payload.bookingId} for ${payload.cottageName} has been recorded.`,
        `Dates: ${payload.checkIn} to ${payload.checkOut}`,
        `Total: Php${payload.totalAmount.toLocaleString()}`,
        "",
        "Please complete payment so an admin can confirm your booking.",
        "",
        "BOLIHON Cove",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    return {
      sent: false,
      reason: `Email provider returned ${response.status}.`,
    };
  }

  return { sent: true };
}

function hasRealEmailConfig(apiKey: string | undefined, from: string | undefined) {
  if (!apiKey || !from) return false;
  return !apiKey.includes("your-") && !from.includes("your-domain.com");
}

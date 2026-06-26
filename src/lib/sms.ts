type BookingSmsPayload = {
  to?: string;
  guestName: string;
  bookingId: string;
  cottageName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
};

export async function sendBookingConfirmationSms(payload: BookingSmsPayload) {
  if (!payload.to) {
    return {
      sent: false,
      reason: "No SMS was sent because no cellphone number was provided.",
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  if (!hasRealSmsConfig(accountSid, authToken, from)) {
    return {
      sent: false,
      reason: "No SMS was sent because SMS is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE to enable SMS confirmations.",
    };
  }

  const body = [
    `Hi ${payload.guestName}, your pending BOLIHON booking ${payload.bookingId} for ${payload.cottageName} has been recorded.`,
    `Dates: ${payload.checkIn} to ${payload.checkOut}.`,
    `Total: Php${payload.totalAmount.toLocaleString()}.`,
    "Please complete payment so an admin can confirm your booking.",
  ].join(" ");

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: from || "",
      To: payload.to,
      Body: body,
    }).toString(),
  });

  if (!response.ok) {
    return {
      sent: false,
      reason: `SMS provider returned ${response.status}.`,
    };
  }

  return { sent: true };
}

function hasRealSmsConfig(accountSid: string | undefined, authToken: string | undefined, from: string | undefined) {
  if (!accountSid || !authToken || !from) return false;
  return !accountSid.includes("your-") && !authToken.includes("your-") && !from.includes("your-");
}

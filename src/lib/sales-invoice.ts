/**
 * Issues the booking's sales invoice number (once) and opens the printable
 * invoice in a new tab. The tab is opened before the request so pop-up
 * blockers treat it as part of the click.
 */
export async function openSalesInvoice(bookingId: string) {
  const invoiceWindow = window.open("about:blank", "_blank");
  const response = await fetch("/api/admin/front-desk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "issue_invoice", id: bookingId }),
  });
  const result = (await response.json()) as Record<string, unknown> & { message?: string };
  if (!response.ok) {
    invoiceWindow?.close();
    throw new Error(result.message || "Unable to issue the sales invoice.");
  }
  const url = `/invoice/${encodeURIComponent(bookingId)}`;
  if (invoiceWindow) invoiceWindow.location.href = url;
  else window.location.href = url;
  window.dispatchEvent(new Event("bolihon-bookings-updated"));
  return result;
}

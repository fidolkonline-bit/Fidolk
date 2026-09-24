import { canonicalSriLankanPhone } from "./customers";
import { formatLkrCents, type ReceiptSale } from "./escpos";

export function formatWhatsAppReceipt(
  receipt: ReceiptSale,
  settings: { businessName: string; phone?: string },
): string {
  const dateStr = new Date(receipt.createdAt).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const lines = [
    `*${settings.businessName || "Fido LK"}*`,
    `Invoice: *${receipt.number}*`,
    `Date: ${dateStr}`,
    `Customer: ${receipt.customerName || "Valued Customer"}`,
    "--------------------------------",
    "*Items:*",
  ];

  for (const item of receipt.lines) {
    const itemTotal = formatLkrCents(item.price * item.quantity);
    lines.push(
      `• ${item.name} (${item.quantity} × ${formatLkrCents(item.price)}) = ${itemTotal}`,
    );
    if (item.imei) {
      lines.push(`  IMEI: ${item.imei}`);
    }
  }

  lines.push("--------------------------------");
  if (receipt.discount > 0) {
    lines.push(`Discount: -${formatLkrCents(receipt.discount)}`);
  }
  lines.push(`*Total: ${formatLkrCents(receipt.total)}*`);
  lines.push(`Paid: ${formatLkrCents(receipt.paid)}`);
  if (receipt.payments?.length)
    for (const payment of receipt.payments)
      lines.push(`${payment.method}: ${formatLkrCents(payment.amount)}`);
  else lines.push(`Method: ${receipt.method}`);

  const balance =
    receipt.status === "Returned"
      ? 0
      : Math.max(
          0,
          receipt.total - receipt.paid - (receipt.returnedTotal || 0),
        );
  if (balance > 0) {
    lines.push(`*Balance Due: ${formatLkrCents(balance)}*`);
    if (receipt.dueDate) lines.push(`Due: ${receipt.dueDate}`);
  }

  lines.push("--------------------------------");
  lines.push("Thank you for your purchase with us!");
  if (settings.phone) {
    lines.push(`Inquiries: ${settings.phone}`);
  }

  return lines.join("\n");
}

export function getWhatsAppReceiptUrl(
  receipt: ReceiptSale,
  rawPhone: string,
  settings: { businessName: string; phone?: string },
): { url: string; phoneDigits: string } | null {
  const canonical = canonicalSriLankanPhone(rawPhone);
  const digits = canonical.replace(/\D/g, "");
  if (!digits) return null;

  const text = formatWhatsAppReceipt(receipt, settings);
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  return { url, phoneDigits: digits };
}

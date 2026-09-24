// ESC/POS Thermal Receipt Builder and Direct USB/Serial Driver for Fido LK

export type PrinterWidth = 32 | 48; // 32 chars for 58mm, 48 chars for 80mm thermal rolls

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private buffer: number[] = [];
  public width: PrinterWidth;

  constructor(width: PrinterWidth = 48) {
    this.width = width;
    this.init();
  }

  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @: Initialize
    return this;
  }

  align(alignment: "left" | "center" | "right"): this {
    const val = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.buffer.push(ESC, 0x61, val);
    return this;
  }

  bold(enable: boolean = true): this {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0);
    return this;
  }

  size(mode: "normal" | "double-height" | "double-width" | "large"): this {
    let val = 0x00;
    if (mode === "double-height") val = 0x01;
    else if (mode === "double-width") val = 0x10;
    else if (mode === "large") val = 0x11;
    this.buffer.push(GS, 0x21, val);
    return this;
  }

  text(str: string): this {
    // Sanitize non-ASCII currency and special characters for standard ESC/POS codepages
    const sanitized = str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x20-\x7E\n\r]/g, "");
    for (let i = 0; i < sanitized.length; i++) {
      this.buffer.push(sanitized.charCodeAt(i));
    }
    return this;
  }

  line(str: string = ""): this {
    if (str) this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  divider(char: string = "-"): this {
    this.align("left");
    this.bold(false);
    this.size("normal");
    this.line(char.repeat(this.width));
    return this;
  }

  twoColumn(left: string, right: string, char: string = " "): this {
    const maxLeft = Math.max(0, this.width - right.length - 1);
    const truncatedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const padding = Math.max(
      1,
      this.width - truncatedLeft.length - right.length,
    );
    this.line(truncatedLeft + char.repeat(padding) + right);
    return this;
  }

  feed(lines: number = 3): this {
    this.buffer.push(ESC, 0x64, Math.max(1, lines));
    return this;
  }

  cut(): this {
    this.feed(3);
    this.buffer.push(GS, 0x56, 0x42, 0x00); // GS V 'B' 0: Full/Partial Cut
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export function formatLkrCents(cents: number): string {
  const rs = (cents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${rs}`;
}

export interface ReceiptSaleLine {
  name: string;
  quantity: number;
  price: number;
  imei?: string;
  priceTier?: string;
  lot?: string;
  unitDiscount?: number;
  originalPrice?: number;
}

export interface ReceiptSale {
  number: string;
  status: string;
  createdAt: string;
  customerName: string;
  lines: ReceiptSaleLine[];
  subtotal?: number;
  discount: number;
  total: number;
  paid: number;
  method: string;
}

export function formatReceiptEscPos(
  receipt: ReceiptSale,
  settings: { businessName: string; address?: string; phone?: string },
  options?: { width?: PrinterWidth; isDemo?: boolean },
): Uint8Array {
  const width = options?.width ?? 48;
  const builder = new EscPosBuilder(width);

  // Header
  builder.align("center");
  builder.bold(true);
  builder.size("large");
  builder.line(settings.businessName || "FIDO LK");

  builder.bold(false);
  builder.size("normal");
  if (settings.address) builder.line(settings.address);
  if (settings.phone) builder.line(`Tel: ${settings.phone}`);

  builder.divider("-");

  // Meta
  builder.align("left");
  builder.twoColumn("Invoice:", receipt.number);
  if (receipt.status === "Returned") {
    builder.bold(true);
    builder.align("center");
    builder.line("*** RETURNED - HISTORICAL INVOICE ***");
    builder.bold(false);
    builder.align("left");
  }

  const dateStr = new Date(receipt.createdAt).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  builder.twoColumn("Date:", dateStr);
  if (receipt.customerName) {
    builder.twoColumn("Customer:", receipt.customerName);
  }

  builder.divider("-");

  // Items
  builder.bold(true);
  builder.twoColumn("Item", "Amount");
  builder.bold(false);
  builder.divider("-");

  for (const line of receipt.lines) {
    const lineTotal = formatLkrCents(line.price * line.quantity);
    builder.twoColumn(line.name, lineTotal);

    const qtyPrice = `  ${line.quantity} x ${formatLkrCents(line.price)}`;
    const extraInfo = line.imei ? ` · IMEI: ${line.imei}` : "";
    builder.line(qtyPrice + extraInfo);

    if (line.priceTier || line.unitDiscount) {
      const tierInfo = line.priceTier ? `  Tier: ${line.priceTier}` : "";
      const discInfo = line.unitDiscount
        ? ` (Disc: ${formatLkrCents(line.unitDiscount)}/ea)`
        : "";
      builder.line(tierInfo + discInfo);
    }
  }

  builder.divider("-");

  // Totals
  if (receipt.discount > 0) {
    builder.twoColumn(
      "Invoice Discount:",
      `-${formatLkrCents(receipt.discount)}`,
    );
  }

  builder.bold(true);
  builder.size("double-height");
  builder.twoColumn("TOTAL:", formatLkrCents(receipt.total));

  builder.bold(false);
  builder.size("normal");
  builder.twoColumn(`Paid (${receipt.method}):`, formatLkrCents(receipt.paid));

  const balance = receipt.total - receipt.paid;
  if (balance > 0) {
    builder.bold(true);
    builder.twoColumn("Balance Due:", formatLkrCents(balance));
    builder.bold(false);
  } else if (balance < 0) {
    builder.twoColumn("Change:", formatLkrCents(-balance));
  }

  builder.divider("-");

  // Footer
  builder.align("center");
  builder.line("Thank you for shopping with Fido LK!");
  if (options?.isDemo) {
    builder.bold(true);
    builder.line("** DEMO RECEIPT - NOT A VALID INVOICE **");
    builder.bold(false);
  }

  builder.cut();
  return builder.build();
}

// Browser Hardware Access (Web Serial & WebUSB)
const PRINTER_STORAGE_KEY = "fido_direct_printer_type";

export function isDirectPrintSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean("serial" in navigator || "usb" in navigator);
}

export function getSavedPrinterType(): "serial" | "usb" | null {
  if (typeof window === "undefined") return null;
  return (
    (localStorage.getItem(PRINTER_STORAGE_KEY) as "serial" | "usb") || null
  );
}

export function savePrinterType(type: "serial" | "usb" | null) {
  if (typeof window === "undefined") return;
  if (type) localStorage.setItem(PRINTER_STORAGE_KEY, type);
  else localStorage.removeItem(PRINTER_STORAGE_KEY);
}

export async function requestAndSaveSerialPrinter(): Promise<boolean> {
  if (typeof window === "undefined" || !("serial" in navigator)) return false;
  try {
    const navSerial = (
      navigator as unknown as {
        serial: { requestPort: () => Promise<unknown> };
      }
    ).serial;
    const port = await navSerial.requestPort();
    if (port) {
      savePrinterType("serial");
      return true;
    }
  } catch (err) {
    console.warn("Serial printer pairing cancelled or failed", err);
  }
  return false;
}

export async function printEscPosDirect(
  data: Uint8Array,
): Promise<{ success: boolean; fallbackNeeded?: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { success: false, fallbackNeeded: true, error: "Not in browser" };
  }

  // 1. Try Web Serial API
  if ("serial" in navigator) {
    try {
      const navSerial = (
        navigator as unknown as { serial: { getPorts: () => Promise<any[]> } }
      ).serial;
      const ports = await navSerial.getPorts();
      if (ports && ports.length > 0) {
        const port = ports[0];
        if (!port.readable || !port.writable) {
          await port.open({
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: "none",
          });
        }
        const writer = port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return { success: true };
      }
    } catch (e: any) {
      console.warn("Direct serial write error:", e?.message || e);
    }
  }

  return {
    success: false,
    fallbackNeeded: true,
    error:
      "No paired direct thermal printer available. Fall back to standard print dialog.",
  };
}

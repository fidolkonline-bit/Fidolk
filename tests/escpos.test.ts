import test from "node:test";
import assert from "node:assert/strict";
import {
  EscPosBuilder,
  formatReceiptEscPos,
  formatLkrCents,
  type ReceiptSale,
} from "../lib/escpos";

test("EscPosBuilder generates correct command bytes", () => {
  const builder = new EscPosBuilder(48);
  builder.align("center");
  builder.bold(true);
  builder.line("FIDO LK");
  builder.divider("-");
  builder.twoColumn("Item A", "Rs. 1,500.00");
  builder.cut();

  const bytes = builder.build();
  assert.ok(bytes.length > 20);

  // Check ESC @ init bytes
  assert.equal(bytes[0], 0x1b);
  assert.equal(bytes[1], 0x40);

  // Check cut command at the end
  const len = bytes.length;
  assert.equal(bytes[len - 4], 0x1d); // GS
  assert.equal(bytes[len - 3], 0x56); // V
  assert.equal(bytes[len - 2], 0x42); // 'B'
  assert.equal(bytes[len - 1], 0x00);
});

test("twoColumn generates exact line width including padding", () => {
  const builder = new EscPosBuilder(48);
  builder.twoColumn("Total:", "Rs. 5,000.00");
  const bytes = builder.build();

  // Find the newline (0x0A)
  const lineBytes = Array.from(bytes.slice(2)); // skip init
  const newlineIdx = lineBytes.indexOf(0x0a);
  assert.equal(
    newlineIdx,
    48,
    "Line width before newline should equal 48 chars",
  );
});

test("formatLkrCents formats cents to Sri Lankan Rupee strings", () => {
  assert.equal(formatLkrCents(120000), "Rs. 1,200.00");
  assert.equal(formatLkrCents(50), "Rs. 0.50");
  assert.equal(formatLkrCents(0), "Rs. 0.00");
  assert.equal(formatLkrCents(1500000), "Rs. 15,000.00");
});

test("formatReceiptEscPos produces valid formatted receipt bytes", () => {
  const sampleSale: ReceiptSale = {
    number: "INV-1001",
    status: "Paid",
    createdAt: "2026-09-24T10:30:00.000Z",
    customerName: "Kasun Perera",
    lines: [
      {
        name: "iPhone 13 Tempered Glass",
        quantity: 2,
        price: 150000, // Rs. 1,500.00 each
      },
      {
        name: "Linen Shirt Blue L",
        quantity: 1,
        price: 450000, // Rs. 4,500.00
        priceTier: "Retail",
      },
    ],
    discount: 50000, // Rs. 500.00 discount
    total: 700000, // Rs. 7,000.00
    paid: 700000,
    method: "Cash",
  };

  const bytes = formatReceiptEscPos(
    sampleSale,
    {
      businessName: "Fido LK Boutique",
      address: "123 Galle Road, Colombo 03",
      phone: "0771234567",
    },
    { width: 48, isDemo: false },
  );

  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("Fido LK Boutique"));
  assert.ok(text.includes("INV-1001"));
  assert.ok(text.includes("Kasun Perera"));
  assert.ok(text.includes("iPhone 13 Tempered Glass"));
  assert.ok(text.includes("Rs. 7,000.00"));
  assert.ok(text.includes("Cash"));
  assert.ok(text.includes("Thank you for shopping"));
});

test("formatReceiptEscPos flags returned invoices and demo mode", () => {
  const sampleSale: ReceiptSale = {
    number: "INV-9999",
    status: "Returned",
    createdAt: "2026-09-24T11:00:00.000Z",
    customerName: "Walk-in Customer",
    lines: [],
    discount: 0,
    total: 0,
    paid: 0,
    method: "Cash",
  };

  const bytes = formatReceiptEscPos(
    sampleSale,
    { businessName: "Fido LK" },
    { width: 32, isDemo: true },
  );

  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("RETURNED"));
  assert.ok(text.includes("DEMO RECEIPT"));
});

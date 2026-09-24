import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWhatsAppReceipt,
  getWhatsAppReceiptUrl,
} from "../lib/receipt-share";
import { generateLankaQrPayload, crc16Ccitt } from "../lib/lankaqr";
import type { ReceiptSale } from "../lib/escpos";

test("formatWhatsAppReceipt generates markdown receipt with totals", () => {
  const sampleSale: ReceiptSale = {
    number: "INV-2002",
    status: "Paid",
    createdAt: "2026-09-24T12:00:00.000Z",
    customerName: "Nimalka Fernando",
    lines: [
      {
        name: "Earphones Type-C",
        quantity: 1,
        price: 250000, // Rs. 2,500.00
      },
    ],
    discount: 20000, // Rs. 200.00
    total: 230000, // Rs. 2,300.00
    paid: 230000,
    method: "Card",
  };

  const text = formatWhatsAppReceipt(sampleSale, {
    businessName: "Fido LK Boutique",
    phone: "0771234567",
  });

  assert.ok(text.includes("*Fido LK Boutique*"));
  assert.ok(text.includes("INV-2002"));
  assert.ok(text.includes("Nimalka Fernando"));
  assert.ok(text.includes("Earphones Type-C"));
  assert.ok(text.includes("Rs. 2,300.00"));
  assert.ok(text.includes("Card"));
});

test("getWhatsAppReceiptUrl returns valid wa.me link for Sri Lankan numbers", () => {
  const sampleSale: ReceiptSale = {
    number: "INV-2003",
    status: "Paid",
    createdAt: "2026-09-24T12:00:00.000Z",
    customerName: "Kamal",
    lines: [],
    discount: 0,
    total: 100000,
    paid: 100000,
    method: "Cash",
  };

  const res = getWhatsAppReceiptUrl(sampleSale, "0771234567", {
    businessName: "Fido LK",
  });

  assert.ok(res !== null);
  assert.equal(res.phoneDigits, "94771234567");
  assert.ok(res.url.startsWith("https://wa.me/94771234567?text="));

  // Invalid phone returns null
  assert.equal(
    getWhatsAppReceiptUrl(sampleSale, "123", { businessName: "Fido LK" }),
    null,
  );
});

test("crc16Ccitt calculates known test vectors", () => {
  // Standard test string "123456789" produces 0x29B1 in CCITT-FALSE
  assert.equal(crc16Ccitt("123456789"), "29B1");
});

test("generateLankaQrPayload produces valid EMVCo TLV string with currency 144 and CRC", () => {
  const payload = generateLankaQrPayload(
    {
      merchantId: "MERCH123456",
      merchantName: "FIDO LK",
      merchantCity: "COLOMBO",
    },
    345000, // Rs. 3,450.00
    "INV-1005",
  );

  // Check Tag 00 format indicator
  assert.ok(payload.startsWith("000201"));

  // Check Tag 01 Dynamic initiation
  assert.ok(payload.includes("010212"));

  // Check Tag 53 LKR Currency
  assert.ok(payload.includes("5303144"));

  // Check Tag 54 Amount (3450.00)
  assert.ok(payload.includes("54073450.00"));

  // Check Tag 58 Country "LK"
  assert.ok(payload.includes("5802LK"));

  // Check Tag 63 CRC (last 4 characters are hex)
  assert.ok(/6304[0-9A-F]{4}$/.test(payload));
});

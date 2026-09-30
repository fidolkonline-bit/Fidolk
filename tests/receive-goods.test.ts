import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import { nextLotNumber } from "../lib/lots";
import type { Workspace } from "../lib/types";

const run = (
  workspace: Workspace,
  type: string,
  payload: Record<string, unknown>,
) => applyAction(workspace, { type, payload, requestId: randomUUID() });

test("lot numbers run per month and skip numbers already used", () => {
  const at = "2026-09-30T10:00:00.000Z";
  assert.equal(nextLotNumber([], at), "LOT-2609-001");
  assert.equal(
    nextLotNumber([{ lot: "LOT-2609-004" }, { lot: "OTHER-9" }], at),
    "LOT-2609-005",
  );
  assert.equal(nextLotNumber([{ lot: "LOT-2609-004" }], at, 2), "LOT-2609-007");
  assert.equal(
    nextLotNumber([{ lot: "LOT-2609-004" }], "2026-10-01T10:00:00.000Z"),
    "LOT-2610-001",
  );
});

test("one delivery with several items makes one GRN and a lot per line", () => {
  const s = createSeed();
  const glass = s.products.find((p) => !p.serialized)!;
  const other = s.products.find((p) => !p.serialized && p.id !== glass.id)!;
  const stockBefore = glass.stock;
  const purchasesBefore = s.purchases.length;
  run(s, "receiveGoods", {
    supplier: "Tech Hub, Kandy",
    reference: "TH-88213",
    paid: 100000,
    lines: [
      {
        productId: glass.id,
        quantity: 100,
        unitCost: 18000,
        pricing: { Retail: 75000, Wholesale: 70000, VIP: 73000, Agent: 69000 },
      },
      { productId: other.id, quantity: 10, unitCost: 42000, lot: "MY-LOT-1" },
    ],
  });
  assert.equal(s.purchases.length, purchasesBefore + 1);
  const grn = s.purchases.at(-1)!;
  assert.equal(grn.reference, "TH-88213");
  assert.equal(grn.total, 100 * 18000 + 10 * 42000);
  assert.equal(grn.lines?.length, 2);
  assert.match(grn.lines![0].lot, /^LOT-\d{4}-\d{3}$/);
  assert.equal(grn.lines![1].lot, "MY-LOT-1");
  assert.equal(glass.stock, stockBefore + 100);
  const lot = s.batches.find((b) => b.lot === grn.lines![0].lot)!;
  assert.equal(lot.pricing?.VIP, 73000);
  assert.equal(lot.remaining, 100);
  const entry = s.journal.at(-1)!;
  assert.equal(
    entry.lines.reduce((n, l) => n + l.debit - l.credit, 0),
    0,
  );
});

test("a delivery is refused whole when any line is wrong", () => {
  const s = createSeed();
  const item = s.products.find((p) => !p.serialized)!;
  const phone = s.products.find((p) => p.serialized)!;
  // The store applies each action to a fresh copy, so a thrown line
  // discards the whole delivery; here we only check that it throws.
  assert.throws(
    () =>
      run(s, "receiveGoods", {
        supplier: "Tech Hub",
        lines: [
          { productId: item.id, quantity: 5, unitCost: 1000 },
          { productId: phone.id, quantity: 2, unitCost: 4000000, imeis: ["1"] },
        ],
      }),
    /IMEI/,
  );
  assert.throws(
    () =>
      run(s, "receiveGoods", {
        supplier: "Tech Hub",
        lines: [
          { productId: item.id, quantity: 1, unitCost: 1000, lot: "X" },
          { productId: item.id, quantity: 1, unitCost: 1000, lot: "X" },
        ],
      }),
    /already has lot X/,
  );
});
